import { useEffect, useState } from 'react'
import { fetchHistoricalContext } from '../api'

// "What the data shows" — one blueprint card per selected date. The mono design
// carries no decorative red/orange/blue fills; the API's semantic `color` still
// tints the kicker so the period type stays readable.
const KICKER_COLOR = {
  red: 'var(--color-accent-900)',
  orange: 'var(--color-accent-700)',
  blue: 'var(--color-accent-500)',
}

// The nearby-event details, styled as a subsection with an amber accent.
function EventDetails({ event }) {
  return (
    <div style={{ borderLeft: '3px solid #eab308', paddingLeft: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{event.name}</div>
      <p className="card-body" style={{ margin: 0 }}>{event.desc}</p>
      <div className="text-muted" style={{ fontSize: 12 }}>{event.date}</div>
    </div>
  )
}

function Panel({ ctx, Corners, event }) {
  return (
    <div className="card blueprint">
      {Corners && <Corners />}
      <div className="card-kicker" style={{ color: KICKER_COLOR[ctx.color] ?? 'var(--color-accent)' }}>
        {ctx.date}
      </div>
      <div className="card-title">{ctx.title}</div>
      <p className="card-body">{ctx.description}</p>
      {event && <EventDetails event={event} />}
    </div>
  )
}

export default function HistoricalContext({ dates, Corners, event }) {
  const [contexts, setContexts] = useState([])

  useEffect(() => {
    let cancelled = false
    Promise.all(dates.map((d) => fetchHistoricalContext(d).catch(() => null)))
      .then((list) => {
        if (!cancelled) setContexts(list)
      })
    return () => {
      cancelled = true
    }
  }, [dates])

  const panels = contexts.filter(Boolean)

  // No context to merge into: fall back to a standalone event banner.
  if (panels.length === 0) {
    if (!event) return null
    return (
      <div
        className="card blueprint"
        style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-6)', borderLeft: '3px solid #eab308' }}
      >
        {Corners && <Corners />}
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{event.name}</div>
        <p className="card-body" style={{ margin: 0, opacity: 0.85 }}>{event.desc}</p>
        <div className="text-muted" style={{ fontSize: 12 }}>{event.date}</div>
      </div>
    )
  }

  // The event is tied to the primary date; merge it into that date's panel
  // (or the first panel if the primary date has no context of its own).
  const eventPanelDate = panels.some((p) => p.date === dates[0]) ? dates[0] : panels[0].date

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 24, marginBottom: 'var(--space-4)' }}>What the data shows</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {panels.map((ctx, i) => (
          <Panel key={ctx.date + i} ctx={ctx} Corners={Corners} event={event && ctx.date === eventPanelDate ? event : null} />
        ))}
      </div>
    </section>
  )
}
