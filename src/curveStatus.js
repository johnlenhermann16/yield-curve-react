// Three-way 2Y10Y curve-shape classification, shared by the "Curve Status" stat
// card and the sidebar/top-bar inversion badge. Same ±0.15% flat band as
// CurveExplainer's classifyShape (kept separate — this one only looks at the
// 2Y/10Y spread, CurveExplainer's also handles the full-curve 'humped' case
// which the stat card doesn't need).
export function curveStatus(spread) {
  if (spread == null) return null
  if (Math.abs(spread) <= 0.15) return 'Flat'
  return spread > 0 ? 'Normal' : 'Inverted'
}
