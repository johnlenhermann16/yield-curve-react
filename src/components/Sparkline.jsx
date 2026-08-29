import { scaleToPath } from './sparklinePath'

export default function Sparkline({ points, color = 'var(--color-accent)', width = 120, height = 36 }) {
  const d = scaleToPath(points, width, height)
  if (!d) return null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
