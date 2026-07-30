import { useEffect, useRef, useState } from 'react'
import { fetchYields } from './api'
import { DEFAULT_DATE } from './constants'
import CountrySelector from './components/CountrySelector'
import YieldChart from './components/YieldChart'
import SpreadChart from './components/SpreadChart'
import HistoricalContext from './components/HistoricalContext'
import CurveExplainer from './components/CurveExplainer'
import { nearestEvent, shortMonth } from './events'

const TODAY = new Date().toISOString().slice(0, 10)

// Read selection from the URL query string; null for anything absent/empty so
// callers can fall back to defaults. Country/date tokens are already URL-safe.
function parseUrl() {
  const p = new URLSearchParams(window.location.search)
  const c = p.get('countries')?.split(',').filter(Boolean)
  const d = p.get('dates')?.split(',').filter(Boolean)
  return { selected: c?.length ? c : null, dates: d?.length ? d : null }
}

// Blueprint registration marks — four children of a .blueprint box.
function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  )
}

function App() {
  const [selected, setSelected] = useState(() => parseUrl().selected ?? ['US', 'UK'])
  const [dates, setDates] = useState(() => parseUrl().dates ?? [DEFAULT_DATE]) // 1–3, position 0 is primary

  const [chartTab, setChartTab] = useState('curve') // 'curve' | 'spread'
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

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      <nav className="nav">
        <span className="nav-brand">Sovereign Curve</span>
        <a href="#tool" aria-current="page">Visualiser</a>
        <a href="#how-to-read">How to read it</a>
        <a href="#methodology">Data &amp; methodology</a>
      </nav>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        <header style={{ maxWidth: '68ch', marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 40, marginBottom: 'var(--space-3)', whiteSpace: 'nowrap' }}>
            Government Bond Yield Curve Visualiser
          </h1>
          <p style={{ fontSize: 17, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)', margin: 0 }}>
            A reference tool for comparing sovereign bond yields across maturities. Select one or
            more countries and up to three dates to see how markets are pricing growth, inflation
            and policy risk along the curve.
          </p>
        </header>

        {/* Controls */}
        <section
          id="tool"
          className="card blueprint elev-sm"
          style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)', display: 'grid', gap: 'var(--space-6)' }}
        >
          <Corners />

          <div className="field" style={{ margin: 0 }}>
            <label>Countries</label>
            <CountrySelector selected={selected} onToggle={toggleCountry} />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Dates</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              {dates.map((d, idx) => {
                const hint = nearestEvent(d)
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <input
                        type="date"
                        className="input"
                        style={{ width: 'auto' }}
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
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        Near: {hint.name} ({shortMonth(hint.date)})
                      </span>
                    )}
                  </div>
                )
              })}
              {dates.length < 3 && (
                <button type="button" onClick={addDate} className="btn btn-ghost">
                  + Compare date
                </button>
              )}
              <button
                type="button"
                onClick={copyLink}
                className="btn btn-secondary"
                style={{ marginLeft: 'auto' }}
              >
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
        </section>

        {/* Chart */}
        <section
          className="card blueprint elev-md"
          style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}
        >
          <Corners />

          {/* Chart type tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {[
              { key: 'curve', label: 'Yield Curve' },
              { key: 'spread', label: '2Y10Y Spread' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setChartTab(t.key)}
                className="btn"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 14,
                  padding: '4px 12px',
                  background: chartTab === t.key ? 'var(--color-accent)' : 'transparent',
                  color: chartTab === t.key ? '#fff' : 'var(--color-text)',
                  border: chartTab === t.key ? '1px solid var(--color-accent)' : '1px solid var(--color-divider)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {chartTab === 'spread' ? (
            <SpreadChart selected={selected} selectedDate={dates[0]} />
          ) : (
          <>
          <div style={{ position: 'relative' }}>
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

          <p
            className="text-muted"
            style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)', fontSize: 12, minHeight: '1.25rem', margin: 0 }}
          >
            {fetchError ? (
              'Couldn’t reach the data service. Try again in a moment.'
            ) : failedNames.length > 0 ? (
              `No data available for ${failedNames.join(', ')} on one or more dates.`
            ) : hasData ? (
              'Line style marks the date — solid, dashed, dotted. Shaded bands mark inverted segments. France, Italy & Spain shown as 10Y diamonds.'
            ) : null}
          </p>
          </>
          )}
        </section>

        {/* Historical context per date — absorbs the nearby-event banner into
            the primary date's panel, or shows it standalone if no context. */}
        <HistoricalContext dates={dates} Corners={Corners} event={bannerEvent} />

        {/* Curve shape explainer */}
        <CurveExplainer selected={selected} countryData={results[0]?.countryData} Corners={Corners} />

        {/* How to read this chart */}
        <section
          id="how-to-read"
          className="card blueprint"
          style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}
        >
          <Corners />
          <h2 style={{ fontSize: 20, marginBottom: 'var(--space-3)' }}>How to read this chart</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', fontSize: 14 }}>
            <div>
              <strong>Maturity</strong>
              <p className="card-body">The horizontal axis. How long until the bond repays its face value — from one month (1M) to thirty years (30Y).</p>
            </div>
            <div>
              <strong>Yield</strong>
              <p className="card-body">The vertical axis. The annualised return an investor earns for holding the bond to maturity, expressed as a percentage.</p>
            </div>
            <div>
              <strong>Normal curve</strong>
              <p className="card-body">Yields rise with maturity. Investors demand extra compensation for locking up money for longer — the typical, healthy shape.</p>
            </div>
            <div>
              <strong>Inverted curve</strong>
              <p className="card-body">Short-term yields exceed long-term yields. Historically associated with expectations of slower growth or a future rate-cutting cycle.</p>
            </div>
          </div>
        </section>

        <footer id="methodology" style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
          <p className="text-muted" style={{ fontSize: 12, maxWidth: '70ch', margin: 0 }}>
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
