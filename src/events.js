// Notable market events shown as chart context. `nearestEvent(date)` returns the
// most recent event the given date falls within 180 days *after* — past-facing,
// not symmetric: a date surfaces the event that has already happened and is
// still fresh. Symmetric would make the default 2023-01-13 pick up SVB (56 days
// later) and clutter an unrelated view, which the spec forbids.
export const EVENTS = [
  { date: '2008-09-15', name: 'Lehman Brothers collapse', desc: 'Credit markets froze, yields crashed as investors fled to safe havens' },
  { date: '2020-03-16', name: 'COVID crash', desc: 'Fed cut rates to zero, curve steepened sharply as short end collapsed' },
  { date: '2022-02-24', name: 'Ukraine invasion', desc: 'Energy shock hit European curves hard, German yields spiked' },
  { date: '2022-03-16', name: 'Fed begins hiking', desc: 'Fastest rate hike cycle in 40 years begins, curve starts inverting' },
  { date: '2023-03-10', name: 'SVB failure', desc: 'Regional banking crisis, short-term yields spiked then reversed on flight to safety' },
]

const DAY = 86400000
const WINDOW_DAYS = 180

// Most recent event on/before `dateStr` (YYYY-MM-DD) within 180 days, else null.
export function nearestEvent(dateStr) {
  const t = Date.parse(dateStr)
  if (Number.isNaN(t)) return null
  let best = null
  for (const ev of EVENTS) {
    const diff = (t - Date.parse(ev.date)) / DAY
    if (diff >= 0 && diff <= WINDOW_DAYS && (!best || ev.date > best.date)) best = ev
  }
  return best
}

// "Sep 2008" — for the date-picker hint.
export function shortMonth(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
