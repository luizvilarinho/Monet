const WIDTH = 64
const HEIGHT = 18
const PAD = 2

// Linha da evolução dos valores, em SVG simples (sem biblioteca de gráficos),
// normalizada entre o mínimo e o máximo; todos iguais = linha reta no meio.
// Decorativa: o primeiro e o último valor vão em texto ao lado.
export function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const span = Math.max(...points) - min
  const x = (i: number) => PAD + (i * (WIDTH - 2 * PAD)) / (points.length - 1)
  const y = (v: number) => (span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((v - min) / span) * (HEIGHT - 2 * PAD))
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden focusable="false">
      <polyline
        points={points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: color }}
      />
    </svg>
  )
}
