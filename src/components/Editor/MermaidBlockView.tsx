import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowsOut, Code, FlowArrow } from '@phosphor-icons/react'
import { fitDiagram, renderMermaid } from '../../lib/mermaid'
import { useImageViewer } from '../ImageViewer/ImageViewer'
import diagramStyles from '../MermaidDiagram/MermaidDiagram.module.css'
import styles from './MermaidBlock.module.css'

// SVG do desenho como imagem para o visualizador: com largura e altura do
// viewBox (o SVG do Mermaid vem com width 100% e max-width no style, e numa
// <img> encolheria para o tamanho padrão).
function svgDataUrl(svg: string): string {
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  const box = el.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (box && box.length === 4 && box[2] > 0 && box[3] > 0) {
    el.setAttribute('width', String(box[2]))
    el.setAttribute('height', String(box[3]))
    el.removeAttribute('style')
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(el))}`
}

// Código mudou com o desenho na tela (desfazer, a mesma nota editada em outro
// lugar): redesenha quando ele para de mudar.
const REDRAW_DELAY_MS = 400

// Bloco ```mermaid da nota: desenho ou código editável. O código é o conteúdo
// do code block; o modo é só da tela, então alternar não muda o documento nem
// dispara autosave. Erro de render: volta ao código, com o erro em cima.
export function MermaidBlockView({ node, editor, getPos }: NodeViewProps) {
  const code = node.textContent
  const empty = code.trim().length === 0
  // Cursor dentro do código (não na seleção do bloco inteiro).
  const selectionInside = () => {
    const pos = getPos()
    if (typeof pos !== 'number') return false
    const { from, to } = editor.state.selection
    return from > pos && to < pos + node.nodeSize
  }
  const [mode, setMode] = useState<'diagram' | 'code'>(() =>
    empty || selectionInside() ? 'code' : 'diagram'
  )
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const diagramRef = useRef<HTMLDivElement>(null)
  // Desenho sem espera: ao montar e ao voltar para o diagrama.
  const drawNowRef = useRef(true)
  const focusCodeRef = useRef(false)
  // React 19 regrava o innerHTML se o objeto muda a cada render.
  const svgHtml = useMemo(() => ({ __html: svg }), [svg])
  const imageViewer = useImageViewer()

  useEffect(() => {
    if (mode !== 'diagram' || empty) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      drawNowRef.current = false
      void renderMermaid(code).then((result) => {
        if (cancelled) return
        if ('svg' in result) {
          setSvg(result.svg)
          setError(null)
        } else {
          setError(result.error)
          setMode('code')
        }
      })
    }, drawNowRef.current ? 0 : REDRAW_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [code, empty, mode])

  useLayoutEffect(() => {
    if (diagramRef.current) fitDiagram(diagramRef.current)
  }, [svg])

  // "Code": cursor no fim do código, pronto para editar (só seleção, o
  // documento não muda).
  useEffect(() => {
    if (mode !== 'code' || !focusCodeRef.current) return
    focusCodeRef.current = false
    const pos = getPos()
    if (typeof pos === 'number' && editor.isEditable) {
      editor.chain().focus(pos + node.nodeSize - 1).run()
    }
  }, [mode, editor, getPos, node])

  // Cursor entrou no código escondido (cursor da nota restaurado, Backspace no
  // parágrafo de baixo, desfazer, busca na nota): mostra o código, para nunca
  // digitar no que não está na tela. Ao montar, o estado inicial já confere.
  useEffect(() => {
    if (mode !== 'diagram') return
    const onSelection = () => {
      if (selectionInside()) setMode('code')
    }
    editor.on('selectionUpdate', onSelection)
    return () => {
      editor.off('selectionUpdate', onSelection)
    }
  }, [mode, editor, getPos, node])

  function showCode() {
    focusCodeRef.current = true
    setMode('code')
  }

  function showDiagram() {
    drawNowRef.current = true
    setMode('diagram')
  }

  const inDiagram = mode === 'diagram'

  return (
    <NodeViewWrapper className={styles.block}>
      <div className={styles.toolbar} contentEditable={false}>
        <span className={styles.label}>Mermaid</span>
        {!inDiagram && empty && <span className={styles.hint}>Paste or type the diagram code below</span>}
        {inDiagram && svg && !empty && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => imageViewer.open(svgDataUrl(svg), 'Mermaid diagram')}
            title="Open the diagram full screen"
          >
            <ArrowsOut size={13} aria-hidden />
            Expand
          </button>
        )}
        <button
          type="button"
          className={`${styles.toggle} ${inDiagram && svg && !empty ? styles.afterExpand : ''}`}
          onClick={inDiagram ? showCode : showDiagram}
          title={inDiagram ? 'Show the Mermaid code' : 'Draw the diagram'}
        >
          {inDiagram ? <Code size={13} aria-hidden /> : <FlowArrow size={13} aria-hidden />}
          {inDiagram ? 'Code' : 'Diagram'}
        </button>
      </div>
      {!inDiagram && error && (
        <div className={`${diagramStyles.error} ${styles.errorArea}`} contentEditable={false}>
          {`Diagram error: ${error}`}
        </div>
      )}
      {inDiagram && empty && (
        <div className={styles.empty} contentEditable={false}>
          Empty diagram. Use Code to add the Mermaid code.
        </div>
      )}
      <div
        ref={diagramRef}
        className={`${diagramStyles.diagram} ${styles.diagramArea} ${inDiagram && !empty ? '' : styles.hidden}`}
        contentEditable={false}
        dangerouslySetInnerHTML={svgHtml}
      />
      <pre className={inDiagram ? styles.hidden : styles.code}>
        <NodeViewContent<'code'> as="code" />
      </pre>
      {imageViewer.viewer}
    </NodeViewWrapper>
  )
}
