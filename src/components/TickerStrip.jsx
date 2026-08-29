import { useEffect, useState } from 'react'
import { fetchYields, fetchPreviousYields } from '../api'
import { COUNTRIES } from '../constants'

const TODAY = new Date().toISOString().slice(0, 10)

// A genuine market ticker across the top of the page — every country's latest
// 10Y yield, independent of the user's current selection. Mount-only fetch,
// reuses the same api.js functions the rest of the app already calls. The
// scroll is a real linear CSS marquee (index.css .ticker-track), the one
// continuous animation in the app — everything else is instant.
export default function TickerStrip() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchYields(COUNTRIES.map((c) => c.name), TODAY)
      .then(async (data) => {
        const latest = COUNTRIES
          .map((c) => {
            const p = data.countries?.[c.name]
            const y = p?.yields?.['10Y']
            return y != null ? { name: c.name, yield: y, actualDate: p.actual_date } : null
          })
          .filter(Boolean)
        const withDeltas = await Promise.all(
          latest.map(async (it) => {
            const prev = await fetchPreviousYields(it.name, it.actualDate).catch(() => null)
            const prevY = prev?.yields?.['10Y']
            const deltaBp = prevY != null ? Math.round((it.yield - prevY) * 100) : null
            return { ...it, deltaBp }
          }),
        )
        if (!cancelled) setItems(withDeltas)
      })
      .catch(() => {
        if (!cancelled) setItems(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!items?.length) return null

  const row = items.map((it) => (
    <span className="ticker-item" key={it.name}>
      <span className="ticker-name">{it.name}</span>
      <span className="ticker-value">10Y {it.yield.toFixed(2)}%</span>
      {it.deltaBp != null && (
        <span className={`ticker-delta ${it.deltaBp >= 0 ? 'up' : 'down'}`}>
          {it.deltaBp >= 0 ? '▲' : '▼'}{Math.abs(it.deltaBp)}bp
        </span>
      )}
    </span>
  ))

  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">{row}</div>
      <div className="ticker-track">{row}</div>
    </div>
  )
}
