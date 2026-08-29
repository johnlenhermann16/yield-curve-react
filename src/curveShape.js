import { MATURITIES } from './constants.js'

// Shape from a single date's yields. Humped = interior peak clearly above both
// ends; otherwise compare 2Y vs 10Y with a small flat band.
// ponytail: fixed 0.15%/0.10% thresholds; tune if a market needs finer bands.
export function classifyShape(yields) {
  if (!yields) return null
  const present = MATURITIES.filter((m) => m in yields)
  if (present.length >= 3) {
    const vals = present.map((m) => yields[m])
    const peak = Math.max(...vals)
    const peakIdx = vals.indexOf(peak)
    const first = vals[0]
    const last = vals[vals.length - 1]
    if (peakIdx > 0 && peakIdx < vals.length - 1 && peak - first > 0.1 && peak - last > 0.1) {
      return 'humped'
    }
  }
  const short = yields['2Y']
  const long = yields['10Y']
  if (short == null || long == null) return null
  const diff = long - short
  if (Math.abs(diff) <= 0.15) return 'flat'
  return diff > 0 ? 'normal' : 'inverted'
}

// One group per distinct shape seen across `results` (one entry per selected
// date), in the order each shape first appears, carrying the date(s) that
// produced it — so a country with a normal primary date and an inverted
// comparison date shows both, instead of only the primary date's shape.
export function groupByShape(results, current) {
  const groups = []
  const byShape = new Map()
  for (const r of results) {
    const shape = classifyShape(r.countryData?.[current]?.yields)
    if (!shape) continue
    let group = byShape.get(shape)
    if (!group) {
      group = { shape, dates: [] }
      byShape.set(shape, group)
      groups.push(group)
    }
    group.dates.push(r.date)
  }
  return groups
}
