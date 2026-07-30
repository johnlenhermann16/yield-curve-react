import { useState } from 'react'
import { MATURITIES } from '../constants'

// Shape from the primary-date yields. Humped = interior peak clearly above both
// ends; otherwise compare 2Y vs 10Y with a small flat band.
// ponytail: fixed 0.15%/0.10% thresholds; tune if a market needs finer bands.
function classifyShape(yields) {
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
    >
      {name}
    </button>
  )
}

// countryData: the primary date's { <name>: { yields } } map.
export default function CurveExplainer({ selected, countryData, Corners }) {
  const [active, setActive] = useState(selected[0])

  if (selected.length === 0) return null
  const current = selected.includes(active) ? active : selected[0]
  const shape = classifyShape(countryData?.[current]?.yields)
  const bullets = shape ? BULLETS[shape] : NO_SHAPE

  return (
    <section
      className="card blueprint"
      style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}
    >
      {Corners && <Corners />}
      <h2 style={{ fontSize: 20, marginBottom: 'var(--space-3)' }}>Curve shape</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {selected.map((name) => (
          <Tab
            key={name}
            name={name}
            active={name === current}
            onClick={() => setActive(name)}
          />
        ))}
      </div>

      <div className="card-kicker" style={{ marginBottom: 'var(--space-3)' }}>
        {current} — {shape ? SHAPE_LABEL[shape] : 'Shape unavailable'}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 14 }}>
            <span
              style={{
                marginTop: 7, height: 6, width: 6, flex: 'none',
                borderRadius: '50%', background: 'var(--color-accent)',
              }}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {current === 'Japan' && (
        <p
          className="text-muted"
          style={{
            marginTop: 'var(--space-4)', marginBottom: 0, padding: 'var(--space-3)',
            fontSize: 14, border: '1px solid var(--color-divider)',
            background: 'var(--color-accent-100)', color: 'var(--color-accent-900)',
          }}
        >
          {JAPAN_YCC}
        </p>
      )}
    </section>
  )
}
