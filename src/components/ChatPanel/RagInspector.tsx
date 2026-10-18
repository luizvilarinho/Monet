import type { RagCandidate, RagResponse } from '../../lib/rag'
import styles from './RagInspector.module.css'

interface RagInspectorProps {
  trace: RagResponse
}

function fmt(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits)
}

function rankWith(rank: number | null, score: number | null, digits: number): string {
  return rank === null ? '—' : `#${rank} (${fmt(score, digits)})`
}

function candidateLabel(c: RagCandidate): string {
  const parts = [c.title || c.documentName]
  if (c.section) parts.push(c.section)
  if (c.page !== null) parts.push(`p. ${c.page}`)
  return parts.join(' · ')
}

// Inspetor do RAG por resposta ("Retrieval details"): consulta original e
// reescrita, candidatos com as pontuações e os trechos enviados ao modelo.
export function RagInspector({ trace }: RagInspectorProps) {
  // Posição de cada trecho enviado, na ordem em que foi para o modelo.
  const sentOrder = new Map(trace.selected.map((c, i) => [c.rowid, i + 1]))
  const flags = [
    trace.rewriteFailed && 'Rewrite failed (original query used)',
    trace.rerankFailed && 'Rerank failed (RRF order used)',
    trace.nothingRelevant && 'Nothing relevant (all below threshold)',
  ].filter((f): f is string => !!f)

  return (
    <details className={styles.inspector}>
      <summary className={styles.summary}>Retrieval details</summary>
      <div className={styles.body}>
        <dl className={styles.facts}>
          <dt>Query</dt>
          <dd>{trace.originalQuery}</dd>
          <dt>Rewritten</dt>
          <dd>{trace.rewrittenQuery ?? '—'}</dd>
          <dt>Keywords</dt>
          <dd>{trace.keywords.length > 0 ? trace.keywords.join(', ') : '—'}</dd>
          <dt>Period</dt>
          <dd>{trace.dateRange ? `${trace.dateRange.from} → ${trace.dateRange.to}` : '—'}</dd>
        </dl>
        {flags.length > 0 && (
          <ul className={styles.flags}>
            {flags.map((f) => (
              <li key={f} className={styles.flag}>{f}</li>
            ))}
          </ul>
        )}
        <p className={styles.count}>
          {trace.selected.length} of {trace.candidates.length} candidates sent to the model
        </p>
        {trace.candidates.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Source</th>
                  <th>Kind</th>
                  <th>Vector</th>
                  <th>BM25</th>
                  <th>RRF</th>
                  <th>Rerank</th>
                  <th>Weight</th>
                  <th>Final</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {trace.candidates.map((c, i) => {
                  const sent = sentOrder.get(c.rowid)
                  return (
                    <tr key={c.rowid} className={sent ? styles.rowSent : undefined}>
                      <td>{i + 1}</td>
                      <td className={styles.source} title={`${c.header}\n${c.content.slice(0, 400)}`}>
                        {candidateLabel(c)}
                      </td>
                      <td>{c.kind}</td>
                      <td>{rankWith(c.vecRank, c.vecDistance, 3)}</td>
                      <td>{rankWith(c.ftsRank, c.bm25, 2)}</td>
                      <td>{fmt(c.rrf, 4)}</td>
                      <td>{fmt(c.rerankScore, 3)}</td>
                      <td>{fmt(c.weight, 2)}</td>
                      <td>{fmt(c.finalScore, 3)}</td>
                      <td>{sent ? `#${sent}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}
