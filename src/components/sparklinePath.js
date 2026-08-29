// Scales a series of { value } points into an SVG path `d` string that fills
// the given width/height. Pure math, no DOM — kept separate from Sparkline.jsx
// so it's testable under plain node (no JSX loader needed).
export function scaleToPath(points, width, height, pad = 2) {
  if (points.length < 2) return ''
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  return points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2)
      const y = pad + (1 - (p.value - min) / span) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
