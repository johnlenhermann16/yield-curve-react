import { useState } from 'react'
import { shortMonth } from '../events'
import { groupByShape } from '../curveShape'

const SHAPE_LABEL = {
  normal: 'Normal (upward-sloping)',
  flat: 'Flat',
  inverted: 'Inverted',
  humped: 'Humped',
}

const BULLETS = {
  normal: [
    'The curve slopes upward — longer-maturity bonds yield more than short ones.',
    'This is the historically typical shape, paying investors more to lock money up for longer.',
    'It generally signals markets expect steady growth and stable-to-rising rates ahead.',
    'The 2Y–10Y spread is positive, the usual sign of a healthy expansion.',
  ],
  inverted: [
    'The curve slopes downward — short-term yields sit above long-term yields.',
    'Markets are pricing future rate cuts, usually because they expect a slowdown.',
    'A sustained 2Y–10Y inversion has preceded most modern recessions, though timing varies.',
    'It reflects tight current policy set against softer long-run growth expectations.',
  ],
  flat: [
    'Short- and long-term yields sit at nearly the same level.',
    'This often marks a transition between a normal curve and an inversion.',
    'It signals uncertainty about the direction of growth and future rate policy.',
    'A small move at the short end can tip a flat curve into inversion.',
  ],
  humped: [
    'Yields rise to a peak at intermediate maturities, then fall at the long end.',
    'The short-to-mid section looks normal while the long end inverts.',
    'It can reflect expectations of near-term rate rises followed by later cuts.',
    'Humped curves are uncommon and often mark turning points in the rate cycle.',
  ],
}

const NO_SHAPE = [
  'Not enough maturities were returned for this date to classify the curve shape.',
  'Some countries report only a single long-dated (10Y) point rather than a full curve.',
  'The 2Y and 10Y yields are the key reference points for shape classification.',
  'Pick a date where a fuller set of maturities is available to see the shape.',
]

const JAPAN_YCC =
  "Japan's curve is shaped by the Bank of Japan's Yield Curve Control (YCC): the BoJ actively caps long-term (10Y) yields, so the shape reflects policy targets as much as market forces."

function Tab({ name, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={{ fontSize: 12, padding: '7px 14px' }}
    >
      {name}
    </button>
  )
}

// results: [{ date, countryData: { <name>: { yields } } }], one entry per
// selected date (primary first).
export default function CurveExplainer({ selected, results }) {
  const [active, setActive] = useState(selected[0])

  if (selected.length === 0) return null
  const current = selected.includes(active) ? active : selected[0]
  const groups = groupByShape(results, current)

  return (
    <section className="card" style={{ padding: '18px 20px' }}>
      <h2 style={{ marginBottom: 12 }}>Curve shape</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {selected.map((name) => (
          <Tab
            key={name}
            name={name}
            active={name === current}
            onClick={() => setActive(name)}
          />
        ))}
      </div>

      {groups.length === 0 ? (
        <>
          <div
            style={{
              alignSelf: 'flex-start', marginBottom: 14,
              fontSize: 11, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent-soft)', color: 'var(--color-accent-2)',
            }}
          >
            {current} — Shape unavailable
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {NO_SHAPE.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span
                  style={{
                    marginTop: 7, height: 6, width: 6, flex: 'none',
                    borderRadius: '50%', background: 'var(--color-accent-2)',
                  }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(({ shape, dates }) => (
            <div key={shape}>
              <div
                style={{
                  alignSelf: 'flex-start', marginBottom: 14,
                  fontSize: 11, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-accent-soft)', color: 'var(--color-accent-2)',
                }}
              >
                {current} — {SHAPE_LABEL[shape]} ({dates.map(shortMonth).join(', ')})
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {BULLETS[shape].map((b, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span
                      style={{
                        marginTop: 7, height: 6, width: 6, flex: 'none',
                        borderRadius: '50%', background: 'var(--color-accent-2)',
                      }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {current === 'Japan' && (
        <p
          style={{
            marginTop: 'var(--space-4)', marginBottom: 0, padding: '12px 14px',
            fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-divider)',
            background: 'var(--color-accent-soft)', color: 'var(--color-text)',
          }}
        >
          {JAPAN_YCC}
        </p>
      )}
    </section>
  )
}
