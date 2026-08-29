import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchYields, fetchPreviousYields, fetchYieldHistory } from './api'
import { COUNTRY_BY_NAME, DEFAULT_DATE, RANGES, SPREAD_COUNTRIES } from './constants'
import { curveStatus } from './curveStatus'
import TickerStrip from './components/TickerStrip'
import Sparkline from './components/Sparkline'
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

// ISO date `years` before today — duplicated from SpreadChart's identical
// private helper rather than shared, for one extra call site (sparkline
// history window) it's not worth exporting.
function isoYearsAgo(years) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
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

export default function Dashboard() {
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

  const [prevYields, setPrevYields] = useState(null) // previous-session comparison, for stat-strip bp deltas
  const [twoYHistory, setTwoYHistory] = useState([]) // sparkline series, [{date, yield}]
  const [tenYHistory, setTenYHistory] = useState([])

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

  // Stat strip. Derived entirely from the primary date's already-fetched data —
  // no extra request. A 10Y-only primary country (France/Italy/Spain) has no 2Y,
  // so the spread and curve-state cells legitimately read "—".
  const primaryCountry = selected[0]
  const primaryPayload = results[0]?.countryData?.[primaryCountry]
  const primaryYields = primaryPayload?.yields
  const tenY = primaryYields?.['10Y']
  const twoY = primaryYields?.['2Y']
  const spread = tenY != null && twoY != null ? tenY - twoY : null
  const status = curveStatus(spread)
  const stat = (v) => (loading || v == null ? '—' : v)

  const tenYDeltaBp =
    tenY != null && prevYields?.yields?.['10Y'] != null
      ? Math.round((tenY - prevYields.yields['10Y']) * 100)
      : null
  const spreadDeltaBp =
    spread != null && prevYields?.yields?.['10Y'] != null && prevYields?.yields?.['2Y'] != null
      ? Math.round((spread - (prevYields.yields['10Y'] - prevYields.yields['2Y'])) * 100)
      : null

  // Previous-session comparison for the stat-strip bp-delta badges — one extra
  // request keyed on the primary date's *resolved* trading day, so it doesn't
  // re-fire on every keystroke of the date picker.
  useEffect(() => {
    if (!primaryCountry || !primaryPayload?.actual_date) {
      setPrevYields(null)
      return
    }
    let cancelled = false
    fetchPreviousYields(primaryCountry, primaryPayload.actual_date)
      .then((r) => {
        if (!cancelled) setPrevYields(r)
      })
      .catch(() => {
        if (!cancelled) setPrevYields(null)
      })
    return () => {
      cancelled = true
    }
  }, [primaryCountry, primaryPayload?.actual_date])

  // 2Y/10Y sparkline history for the primary country, trailing 1 year.
  useEffect(() => {
    if (!primaryCountry) {
      setTwoYHistory([])
      setTenYHistory([])
      return
    }
    let cancelled = false
    const from = isoYearsAgo(1)
    Promise.all([
      fetchYieldHistory(primaryCountry, '2Y', from, undefined),
      fetchYieldHistory(primaryCountry, '10Y', from, undefined),
    ])
      .then(([two, ten]) => {
        if (cancelled) return
        setTwoYHistory(two.data)
        setTenYHistory(ten.data)
      })
      .catch(() => {
        if (!cancelled) {
          setTwoYHistory([])
          setTenYHistory([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [primaryCountry])

  function anchor(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Slide the tab underline. One shared indicator measured off the active
  // button — per-button borders can't animate across the gap between tabs.
  // The rail wraps onto its own row below 900px, so re-measure on resize too.
  const tabRailRef = useRef(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const rail = tabRailRef.current
    if (!rail) return
    function measure() {
      const active = rail.querySelector('.chart-tab.active')
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(rail)
    return () => ro.disconnect()
  }, [chartTab])

  const countryColor = COUNTRY_BY_NAME[primaryCountry]?.color ?? 'var(--color-accent)'
  const twoYPoints = twoYHistory.map((p) => ({ value: p.yield }))
  const tenYPoints = tenYHistory.map((p) => ({ value: p.yield }))
  const twoYLatest = twoYHistory.at(-1)?.yield
  const twoYDeltaBp =
    twoYLatest != null && twoYHistory[0]?.yield != null
      ? Math.round((twoYLatest - twoYHistory[0].yield) * 100)
      : null
  const tenYLatest = tenYHistory.at(-1)?.yield
  const tenYHistDeltaBp =
    tenYLatest != null && tenYHistory[0]?.yield != null
      ? Math.round((tenYLatest - tenYHistory[0].yield) * 100)
      : null

  return (
    <>
      <TickerStrip />
      <header className="app-header">
        <div className="app-header-row">
          <span className="app-brand">Yield Curve Visualiser</span>

          {/* The only tab bar. These used to exist in both the sidebar and the
              chart card; one rail with a sliding underline replaces both. */}
          <div className="tab-rail" ref={tabRailRef}>
            {CHART_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setChartTab(t.key)
                  anchor('chart-card')
                }}
                aria-current={chartTab === t.key ? 'true' : undefined}
                className={`chart-tab${chartTab === t.key ? ' active' : ''}`}
              >
                {t.label}
              </button>
            ))}
            <span
              className="tab-indicator"
              aria-hidden="true"
              style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
            />
          </div>
        </div>
      </header>

      <div className="dashboard-content">
            <section id="overview-stats" className="stat-strip">
              <div className="stat-cell">
                <span className="stat-label">{primaryCountry ? `${primaryCountry} 10Y` : '10Y Yield'}</span>
                <span className="stat-value accent flash" key={tenY ?? 'none'}>
                  {stat(tenY == null ? null : `${tenY.toFixed(2)}%`)}
                </span>
                {tenYDeltaBp != null && (
                  <span className={`delta ${tenYDeltaBp >= 0 ? 'up' : 'down'}`}>
                    {tenYDeltaBp >= 0 ? '▲' : '▼'} {Math.abs(tenYDeltaBp)} bp
                  </span>
                )}
              </div>
              <div className="stat-cell">
                <span className="stat-label">{primaryCountry ? `${primaryCountry} 2s10s` : '2s10s Spread'}</span>
                <span className="stat-value accent flash" key={spread ?? 'none'}>
                  {stat(spread == null ? null : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`)}
                </span>
                {spreadDeltaBp != null && (
                  <span className={`delta ${spreadDeltaBp >= 0 ? 'up' : 'down'}`}>
                    {spreadDeltaBp >= 0 ? '▲' : '▼'} {Math.abs(spreadDeltaBp)} bp
                  </span>
                )}
              </div>
              <div className="stat-cell">
                <span className="stat-label">Curve Status</span>
                <span className="stat-value">
                  <span
                    className="status-dot"
                    style={{
                      background:
                        status === 'Inverted'
                          ? 'var(--color-accent-red)'
                          : status === 'Flat'
                            ? 'var(--color-accent-2)'
                            : status === 'Normal'
                              ? 'var(--color-positive)'
                              : 'var(--color-divider-strong)',
                    }}
                  />
                  {status ?? '—'}
                </span>
              </div>
            </section>

            <main className="dashboard-body">
              {/* Controls */}
              <section className="card" style={{ padding: '20px 22px', display: 'grid', gap: 20 }}>
                <div id="countries-field" className="field" style={{ margin: 0 }}>
                  <label>Countries</label>
                  <CountrySelector selected={selected} onToggle={toggleCountry} />
                </div>

                <div id="dates-field" className="field" style={{ margin: 0 }}>
                  <label>Dates <span style={{ opacity: 0.7, fontWeight: 400, textTransform: 'none' }}>— up to 3</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
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
                            <span style={{ fontSize: 10, color: 'var(--color-accent)' }}>
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
              <section id="chart-card" className="card" style={{ padding: '20px 22px 22px' }}>
                {/* The tabs moved to the header; this row is the card's own
                    title, with the spread range pills trailing it. */}
                <div className="chart-card-head">
                  <h2 style={{ fontSize: 15, margin: 0 }}>
                    {chartTab === 'spread' ? '2Y10Y spread' : 'Government bond yield curve'}
                  </h2>

                  {showRanges && (
                    <div className="chart-range-pills">
                      {RANGES.map((r) => (
                        <button
                          key={r.label}
                          type="button"
                          onClick={() => setYears(r.years)}
                          aria-pressed={years === r.years}
                          className={`range-pill${years === r.years ? ' range-pill-on' : ''}`}
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
                        margin: '0 0 14px', fontSize: 11, minHeight: '1.25rem',
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
                            background: 'color-mix(in srgb, var(--color-surface-1) 72%, transparent)',
                          }}
                        >
                          <span className="blink" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>
                            LOADING…
                          </span>
                        </div>
                      )}

                      {hasData ? (
                        <YieldChart series={series} primaryDate={dates[0]} />
                      ) : (
                        <div
                          className="text-muted"
                          style={{ display: 'flex', height: 'var(--chart-h)', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
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
              <HistoricalContext dates={dates} event={bannerEvent} />

              {/* Curve shape explainer beside the "how to read" icon cards. When no
                  country is selected CurveExplainer renders null, so collapse to one
                  column rather than leaving a hole in the row. */}
              <div
                className={`explainer-grid${selected.length ? ' has-selection' : ''}`}
                style={{ display: 'grid', gap: 16 }}
              >
                <CurveExplainer selected={selected} results={results} />

                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}
                >
                  {HOW_TO_READ.map((c) => (
                    <div key={c.title} className="card card-hover" style={{ padding: 18, gap: 10 }}>
                      <span
                        style={{
                          width: 36, height: 36, flex: 'none', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-accent-soft)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24" width="18" height="18" fill="none"
                          stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round"
                          aria-hidden="true"
                        >
                          {c.points.map((p) => <polyline key={p} points={p} />)}
                        </svg>
                      </span>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                      <p className="card-body" style={{ fontSize: 12 }}>{c.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sparkline trend panels + Spread Overview. */}
              <section className="bottom-grid">
                <div className="card" style={{ padding: '16px 18px' }}>
                  <div className="sparkline-card-head">
                    <span className="card-kicker">{primaryCountry ? `${primaryCountry} 2Y Yield` : '2Y Yield'}</span>
                  </div>
                  {twoYPoints.length >= 2 ? (
                    <>
                      <div className="sparkline-card-value flash" key={twoYLatest}>
                        {twoYLatest != null ? `${twoYLatest.toFixed(2)}%` : '—'}
                      </div>
                      {twoYDeltaBp != null && (
                        <span className={`delta ${twoYDeltaBp >= 0 ? 'up' : 'down'}`}>
                          {twoYDeltaBp >= 0 ? '▲' : '▼'} {Math.abs(twoYDeltaBp)} bp · 1Y
                        </span>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <Sparkline points={twoYPoints} color={countryColor} />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                      No 2Y data for {primaryCountry ?? 'this selection'}.
                    </p>
                  )}
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div className="sparkline-card-head">
                    <span className="card-kicker">{primaryCountry ? `${primaryCountry} 10Y Yield` : '10Y Yield'}</span>
                  </div>
                  {tenYPoints.length >= 2 ? (
                    <>
                      <div className="sparkline-card-value flash" key={tenYLatest}>
                        {tenYLatest != null ? `${tenYLatest.toFixed(2)}%` : '—'}
                      </div>
                      {tenYHistDeltaBp != null && (
                        <span className={`delta ${tenYHistDeltaBp >= 0 ? 'up' : 'down'}`}>
                          {tenYHistDeltaBp >= 0 ? '▲' : '▼'} {Math.abs(tenYHistDeltaBp)} bp · 1Y
                        </span>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <Sparkline points={tenYPoints} color={countryColor} />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                      No 10Y data for {primaryCountry ?? 'this selection'}.
                    </p>
                  )}
                </div>

                <div className="card" style={{ padding: '18px 20px' }}>
                  <span className="card-kicker">Spread Overview</span>
                  <div className="spread-overview-value flash" key={spread ?? 'none'}>
                    {spread == null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`}
                  </div>
                  <p className="text-muted" style={{ fontSize: 11, margin: 0 }}>
                    {primaryCountry ? `${primaryCountry} 2Y10Y` : 'No country selected'}
                    {primaryPayload?.actual_date ? ` · ${primaryPayload.actual_date}` : ''}
                  </p>
                  <div className="spread-overview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setChartTab('spread')
                        anchor('chart-card')
                      }}
                    >
                      View History
                    </button>
                  </div>
                </div>
              </section>

              <footer id="methodology" style={{ paddingTop: 16, borderTop: '1px solid var(--color-divider)' }}>
                <p style={{ fontSize: 11, maxWidth: '70ch', margin: 0, color: 'var(--color-muted)' }}>
                  For educational purposes only — not financial advice. Figures should not be used for
                  trading or investment decisions. Data sources: FRED, Bank of England, ECB, Bank of
                  Canada, SNB, MOF Japan.
                </p>
              </footer>
            </main>
      </div>
    </>
  )
}
