import { useEffect, useRef, useState } from 'react'
import { fetchYields } from './api'
import { COUNTRIES, DEFAULT_DATE, RANGES, SPREAD_COUNTRIES } from './constants'
import CountrySelector from './components/CountrySelector'
import YieldChart from './components/YieldChart'
import SpreadChart from './components/SpreadChart'
import HistoricalContext from './components/HistoricalContext'
import CurveExplainer from './components/CurveExplainer'
import { nearestEvent, shortMonth } from './events'

const TODAY = new Date().toISOString().slice(0, 10)

// Page gutter: content sits 40px inside a 1200px column, matched by .nav-inner
// and the header panel so nav, hero and cards all share one left edge.
const COLUMN = { maxWidth: 1200, margin: '0 auto', padding: '0 40px' }

// Read selection from the URL query string; null for anything absent/empty so
// callers can fall back to defaults. Country/date tokens are already URL-safe.
function parseUrl() {
  const p = new URLSearchParams(window.location.search)
  const c = p.get('countries')?.split(',').filter(Boolean)
  const d = p.get('dates')?.split(',').filter(Boolean)
  return { selected: c?.length ? c : null, dates: d?.length ? d : null }
}

// The blueprint registration marks are gone in this design. Kept as a no-op so
// HistoricalContext and CurveExplainer keep their existing prop signature.
function Corners() {
  return null
}

// "How to read this chart", as icon cards. Each entry's polylines are drawn in a
// 24×24 box — one stroke path per line, no icon library.
const HOW_TO_READ = [
  {
    title: 'Maturity',
    points: ['3,19 21,19', '7,19 7,14 12,19 12,10 17,19 17,6'],
    body: 'The horizontal axis. How long until the bond repays its face value — from one month (1M) to thirty years (30Y).',
  },
  {
    title: 'Yield',
    points: ['4,21 4,3', '4,10 10,10 10,6 16,6'],
    body: 'The vertical axis. The annualised return an investor earns for holding the bond to maturity, expressed as a percentage.',
  },
  {
    title: 'Normal curve',
    points: ['3,19 9,15 15,9 21,5'],
    body: 'Yields rise with maturity. Investors demand extra compensation for locking up money for longer — the typical, healthy shape.',
  },
  {
    title: 'Inverted curve',
    points: ['3,5 9,9 15,15 21,19'],
    body: 'Short-term yields exceed long-term yields. Historically associated with expectations of slower growth or a future rate-cutting cycle.',
  },
]

const CHART_TABS = [
  { key: 'curve', label: 'Yield Curve' },
  { key: 'spread', label: '2Y10Y Spread' },
]

function App() {
  const [selected, setSelected] = useState(() => parseUrl().selected ?? ['US', 'UK'])
  const [dates, setDates] = useState(() => parseUrl().dates ?? [DEFAULT_DATE]) // 1–3, position 0 is primary

  const [chartTab, setChartTab] = useState('curve') // 'curve' | 'spread'
  // Spread lookback lives here, not in SpreadChart, because the range buttons
  // render on the chart tab rail below. SpreadChart still drives it from its
  // auto-widen effect via setYears.
  const [years, setYears] = useState(4)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([]) // [{ date, countryData, failed }]
  const [fetchError, setFetchError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Keep the URL in sync with the selection so the view is shareable. Compare
  // against the live URL first: that makes popstate restores (which update the
  // URL before our state) a no-op here, avoiding a push loop. First run just
  // normalises the URL (replace), later changes add history entries (push).
  const firstSync = useRef(true)
  useEffect(() => {
    const p = new URLSearchParams()
    if (selected.length) p.set('countries', selected.join(','))
    if (dates.length) p.set('dates', dates.join(','))
    const qs = p.toString()
    const search = qs ? `?${qs}` : ''
    if (search !== window.location.search) {
      const url = `${window.location.pathname}${search}${window.location.hash}`
      window.history[firstSync.current ? 'replaceState' : 'pushState'](null, '', url)
    }
    firstSync.current = false
  }, [selected, dates])

  // Back/forward: re-read the URL and restore the selection it encodes.
  useEffect(() => {
    function onPop() {
      const u = parseUrl()
      setSelected(u.selected ?? ['US', 'UK'])
      setDates(u.dates ?? [DEFAULT_DATE])
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked (e.g. insecure context) — leave button unchanged */
    }
  }

  useEffect(() => {
    if (selected.length === 0) {
      setResults([])
      setFetchError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    Promise.all(dates.map((d) => fetchYields(selected, d)))
      .then((datasets) => {
        if (cancelled) return
        const next = datasets.map((data, idx) => {
          const ok = {}
          const bad = []
          for (const name of selected) {
            const payload = data.countries?.[name]
            if (payload && !payload.error && Object.keys(payload.yields || {}).length) {
              ok[name] = payload
            } else {
              bad.push(name)
            }
          }
          return { date: dates[idx], countryData: ok, failed: bad }
        })
        setResults(next)
      })
      .catch((err) => {
        if (cancelled) return
        setResults([])
        setFetchError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, dates])

  function toggleCountry(name) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  function setDateAt(idx, value) {
    if (!value) return
    setDates((prev) => prev.map((d, i) => (i === idx ? value : d)))
  }

  function addDate() {
    setDates((prev) => (prev.length < 3 ? [...prev, prev[0]] : prev))
  }

  function removeDate(idx) {
    setDates((prev) => prev.filter((_, i) => i !== idx))
  }

  // Only plot dated series that actually returned something.
  const series = results.filter((r) => Object.keys(r.countryData).length > 0)
  const hasData = series.length > 0
  const failedNames = [...new Set(results.flatMap((r) => r.failed))]
  const DATE_LABELS = ['Primary date', 'Second date', 'Third date']
  const bannerEvent = nearestEvent(dates[0])

  // Range buttons live on the tab rail, so gate them the same way SpreadChart
  // gates its plot — it early-returns a "pick a supported country" notice, and
  // the pills must not hover over that.
  const showRanges =
    chartTab === 'spread' && SPREAD_COUNTRIES.some((c) => selected.includes(c))

  // Stats band. Derived entirely from the primary date's already-fetched data —
  // no extra request. A 10Y-only primary country (France/Italy/Spain) has no 2Y,
  // so the spread and curve-state tiles legitimately read "—".
  const primaryCountry = selected[0]
  const primaryYields = results[0]?.countryData?.[primaryCountry]?.yields
  const tenY = primaryYields?.['10Y']
  const twoY = primaryYields?.['2Y']
  const spread = tenY != null && twoY != null ? tenY - twoY : null
  const stat = (v) => (loading || v == null ? '—' : v)
  const stats = [
    {
      value: stat(tenY == null ? null : `${tenY.toFixed(2)}%`),
      label: primaryCountry ? `${primaryCountry} 10Y yield · ${dates[0]}` : '10Y yield',
    },
    {
      value: stat(spread == null ? null : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`),
      label: primaryCountry ? `${primaryCountry} 2s10s spread` : '2s10s spread',
      tone: 'var(--color-accent-2)',
    },
    {
      value: stat(spread == null ? null : spread < 0 ? 'Inverted' : 'Normal'),
      label: 'Curve state, primary date',
    },
    { value: String(COUNTRIES.length), label: 'Sovereign markets · 11 maturities' },
  ]

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <polyline points="4,17 10,11 15,14 20,6" />
            </svg>
          </span>
          <a href="#tool" aria-current="page">Visualiser</a>
          <a href="#how-to-read">How to read it</a>
          <a href="#methodology">Data &amp; methodology</a>
          <button type="button" onClick={copyLink} className="pill-accent">
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </nav>

      {/* Header panel — full-bleed dot grid with a soft accent glow. */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '52px 0 40px',
          backgroundColor: 'var(--color-bg)',
          backgroundImage:
            'radial-gradient(circle at 74% 12%, var(--color-accent-glow), transparent 55%), radial-gradient(var(--color-dot) 1px, transparent 1px)',
          backgroundSize: 'auto, 22px 22px',
        }}
      >
        <div style={COLUMN}>
          <header className="scfade" style={{ maxWidth: '64ch' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 13px', borderRadius: 999,
                border: '1px solid var(--color-divider-strong)', background: 'rgba(18, 18, 24, 0.04)',
                fontSize: 12, letterSpacing: '0.04em', color: 'var(--color-muted)', marginBottom: 20,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-2)' }} />
              Nine sovereign markets · 1M to 30Y · since 1990
            </div>
            <h1 style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              Government Bond<br />Yield Curve Visualiser
            </h1>
            <p style={{ fontSize: 17, color: 'var(--color-muted)', margin: 0, textWrap: 'pretty' }}>
              A reference tool for comparing sovereign bond yields across maturities. Select one or
              more countries and up to three dates to see how markets are pricing growth, inflation
              and policy risk along the curve.
            </p>
          </header>

          <div
            className="scfade"
            style={{
              position: 'relative', marginTop: 36, animationDelay: '60ms',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              overflow: 'hidden',
            }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                style={{
                  padding: '30px 28px', textAlign: 'center',
                  borderLeft: i > 0 ? '1px solid var(--color-divider)' : undefined,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 46,
                    lineHeight: 1, letterSpacing: '-0.02em', color: s.tone ?? 'var(--color-text)',
                  }}
                >
                  {s.value}
                </div>
                <div style={{ marginTop: 9, fontSize: 13, color: 'var(--color-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main style={{ ...COLUMN, paddingTop: 8, paddingBottom: 44, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Controls */}
        <section
          id="tool"
          className="card scfade"
          style={{ padding: '26px 28px', display: 'grid', gap: 24, animationDelay: '120ms' }}
        >
          <Corners />

          <div className="field" style={{ margin: 0 }}>
            <label>Countries</label>
            <CountrySelector selected={selected} onToggle={toggleCountry} />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Dates <span style={{ opacity: 0.7, fontWeight: 400 }}>— up to 3</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
              {dates.map((d, idx) => {
                const hint = nearestEvent(d)
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="date"
                        className="input"
                        style={{ width: 'auto', borderColor: idx === 0 ? 'var(--color-accent)' : undefined }}
                        value={d}
                        min="1990-01-01"
                        max={TODAY}
                        onChange={(e) => setDateAt(idx, e.target.value)}
                        aria-label={DATE_LABELS[idx] ?? `Date ${idx + 1}`}
                      />
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => removeDate(idx)}
                          aria-label={`Remove ${DATE_LABELS[idx] ?? 'date'}`}
                          className="btn btn-icon btn-ghost"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {hint && (
                      <span style={{ fontSize: 11, color: 'var(--color-accent-2)' }}>
                        Near: {hint.name} ({shortMonth(hint.date)})
                      </span>
                    )}
                  </div>
                )
              })}
              {dates.length < 3 && (
                <button type="button" onClick={addDate} className="btn btn-dashed">
                  + Compare date
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Chart */}
        <section className="card scfade" style={{ padding: '26px 28px 28px', animationDelay: '180ms' }}>
          <Corners />

          {/* Chart type tabs, with the spread range pills on the same rail. */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 26,
              borderBottom: '1px solid var(--color-divider)', marginBottom: 18,
            }}
          >
            {CHART_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setChartTab(t.key)}
                aria-current={chartTab === t.key ? 'true' : undefined}
                style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16,
                  padding: '0 2px 12px', marginBottom: -1, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${chartTab === t.key ? 'var(--color-accent)' : 'transparent'}`,
                  color: chartTab === t.key ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {t.label}
              </button>
            ))}

            {showRanges && (
              <div style={{ marginLeft: 'auto', paddingBottom: 12, display: 'flex', gap: 7 }}>
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setYears(r.years)}
                    aria-pressed={years === r.years}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em',
                      padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                      background: years === r.years ? 'var(--color-accent)' : 'transparent',
                      border: `1px solid ${years === r.years ? 'var(--color-accent)' : 'var(--color-divider-strong)'}`,
                      color: years === r.years ? '#fff' : 'var(--color-muted)',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chartTab === 'spread' ? (
            <SpreadChart
              selected={selected}
              selectedDate={dates[0]}
              years={years}
              setYears={setYears}
            />
          ) : (
            <>
              <p
                style={{
                  margin: '0 0 16px', fontSize: 13, minHeight: '1.25rem',
                  color: 'var(--color-muted)',
                }}
              >
                {fetchError ? (
                  'Couldn’t reach the data service. Try again in a moment.'
                ) : failedNames.length > 0 ? (
                  `No data available for ${failedNames.join(', ')} on one or more dates.`
                ) : hasData ? (
                  'Line style marks the date — solid, dashed, dotted. Shaded bands mark inverted segments. France, Italy & Spain shown as 10Y diamonds.'
                ) : null}
              </p>

              <div className="plot-inset">
                {loading && (
                  <div
                    style={{
                      position: 'absolute', inset: 0, zIndex: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'color-mix(in srgb, var(--color-bg) 70%, transparent)',
                      backdropFilter: 'blur(1px)',
                    }}
                  >
                    <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13 }}>
                      <span
                        style={{
                          height: 16, width: 16, borderRadius: '50%',
                          border: '2px solid var(--color-divider)',
                          borderTopColor: 'var(--color-accent)',
                          animation: 'spin 0.7s linear infinite',
                        }}
                      />
                      Loading yield data…
                    </div>
                  </div>
                )}

                {hasData ? (
                  <YieldChart series={series} primaryDate={dates[0]} />
                ) : (
                  <div
                    className="text-muted"
                    style={{ display: 'flex', height: 520, alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
                  >
                    {selected.length === 0
                      ? 'Select one or more countries to plot.'
                      : loading
                        ? ' '
                        : 'No data to display for this selection.'}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Historical context per date — absorbs the nearby-event banner into
            the primary date's panel, or shows it standalone if no context. */}
        <HistoricalContext dates={dates} Corners={Corners} event={bannerEvent} />

        {/* Curve shape explainer beside the "how to read" icon cards. When no
            country is selected CurveExplainer renders null, so collapse to one
            column rather than leaving a hole in the row. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selected.length ? '1.15fr 1fr' : '1fr',
            gap: 18,
          }}
        >
          <CurveExplainer selected={selected} countryData={results[0]?.countryData} Corners={Corners} />

          <div
            id="how-to-read"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}
          >
            {HOW_TO_READ.map((c) => (
              <div key={c.title} className="card card-hover" style={{ padding: 22, gap: 12 }}>
                <span
                  style={{
                    width: 42, height: 42, flex: 'none', borderRadius: 11,
                    background: 'var(--color-accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24" width="20" height="20" fill="none"
                    stroke="var(--color-accent-2)" strokeWidth="1.6" strokeLinecap="round"
                    aria-hidden="true"
                  >
                    {c.points.map((p) => <polyline key={p} points={p} />)}
                  </svg>
                </span>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18 }}>{c.title}</div>
                <p className="card-body" style={{ fontSize: 13 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        <footer id="methodology" style={{ paddingTop: 22, borderTop: '1px solid var(--color-divider)' }}>
          <p style={{ fontSize: 12, maxWidth: '70ch', margin: 0, color: 'var(--color-muted)' }}>
            For educational purposes only — not financial advice. Figures should not be used for
            trading or investment decisions. Data sources: FRED, Bank of England, ECB, Bank of
            Canada, SNB, MOF Japan.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
