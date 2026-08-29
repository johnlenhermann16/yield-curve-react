import { useEffect, useState } from 'react'
import { fetchHistoricalContext } from '../api'

// "What the data shows" — one card per selected date. The design carries no
// decorative fills; the API's semantic `color` still tints the kicker so the
// period type stays readable.
const KICKER_COLOR = {
  red: 'var(--color-accent-red)',
  orange: 'var(--color-accent-2)',
  blue: 'var(--color-accent)',
}

const CARD_PAD = '16px 18px'

// The nearby-event details, as an accent-soft block inside the panel.
function EventDetails({ event }) {
  return (
    <div
      style={{
        marginTop: 'var(--space-4)', padding: '12px 14px', borderRadius: 0,
        border: '1px solid var(--color-accent-soft)', background: 'var(--color-accent-soft)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13 }}>{event.name}</div>
      <p className="card-body" style={{ margin: '4px 0 0', fontSize: 12 }}>{event.desc}</p>
      <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
        {event.date}
      </div>
    </div>
  )
}

function Panel({ ctx, event }) {
  return (
    <div className="card card-hover" style={{ padding: CARD_PAD }}>
      <div className="card-kicker" style={{ color: KICKER_COLOR[ctx.color] ?? 'var(--color-accent-2)' }}>
        {ctx.date}
      </div>
      <div className="card-title">{ctx.title}</div>
      <p className="card-body">{ctx.description}</p>
      {event && <EventDetails event={event} />}
    </div>
  )
}

export default function HistoricalContext({ dates, event }) {
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
        className="card card-hover"
        style={{ marginBottom: 'var(--space-6)', padding: CARD_PAD, background: 'var(--color-accent-soft)' }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{event.name}</div>
        <p className="card-body" style={{ margin: 0 }}>{event.desc}</p>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>{event.date}</div>
      </div>
    )
  }

  // The event is tied to the primary date; merge it into that date's panel
  // (or the first panel if the primary date has no context of its own).
  const eventPanelDate = panels.some((p) => p.date === dates[0]) ? dates[0] : panels[0].date

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2>What the data shows</h2>
      <div
        style={{
          display: 'grid',
          // auto-fit rather than the mock's fixed 1fr 1fr: three dates would
          // otherwise leave a 2+1 row with a hole in it.
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {panels.map((ctx, i) => (
          <Panel key={ctx.date + i} ctx={ctx} event={event && ctx.date === eventPanelDate ? event : null} />
        ))}
      </div>
    </section>
  )
}
