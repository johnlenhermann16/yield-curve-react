import { useEffect, useState } from 'react'
import Plot from 'react-plotly.js'
import { fetchSpread } from '../api'
import { shortMonth } from '../events'
import { COUNTRY_BY_NAME, SPREAD_COUNTRIES } from '../constants'

const MAX_FROM = '1976-06-01' // T10Y2Y series start on FRED

// ISO date `years` before today.
function isoYearsAgo(years) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

function fromForRange(years) {
  if (years === 'max' || years === MAX_FROM) return MAX_FROM
  return isoYearsAgo(years)
}

// Normalize a Date, epoch-ms timestamp, or ISO string to a "YYYY-MM-DD" string,
// so downstream string comparisons never coerce to NaN (a non-string operand
// makes `>=` numeric, and Number("2025-07-28") is NaN → every compare false).
function toISODateString(input) {
  if (typeof input === 'string') return input.slice(0, 10)
  return new Date(input).toISOString().slice(0, 10)
}

// Smallest range (`years`, or 'max') whose start covers `dateStr`. Returns null
// when the date is within the last year — any current range already covers it.
function rangeForDate(dateStr) {
  const iso = toISODateString(dateStr)
  if (iso >= isoYearsAgo(1)) return null
  if (iso >= isoYearsAgo(2)) return 2
  if (iso >= isoYearsAgo(4)) return 4
  if (iso >= isoYearsAgo(10)) return 10
  return 'max'
}

// ISO date shifted by `delta` years (negative moves back).
function addYears(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() + delta)
  return d.toISOString().slice(0, 10)
}

// "13 Jan 2023" — matches the hover tooltip's date format.
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// The spread chart draws one coloured line per selected country that /api/spread
// can serve (SPREAD_COUNTRIES: US from FRED T10Y2Y, UK from the BoE gilt curve,
// Germany from Bundesbank bunds). Everything below is driven off that list
// rather than per-country props, so adding a fourth country is a one-line change
// in constants.js. With none of them selected we show the grey notice per spec
// rather than fetching.
// `years`/`setYears` are owned by App so the range buttons can render on the
// chart tab rail alongside the Yield Curve / 2Y10Y tabs. Everything else about
// the range behaviour — including the auto-widen effect below, which only calls
// setYears and never reads it — is unchanged by that lift.
export default function SpreadChart({ selected, selectedDate, years, setYears }) {
  const shown = SPREAD_COUNTRIES.filter((c) => selected.includes(c))
  const hasUnsupported = selected.some((c) => !SPREAD_COUNTRIES.includes(c))
  // Stable dep for the fetch effect: `shown` is a fresh array every render, so
  // using it directly would re-fire the effect forever.
  const shownKey = shown.join(',')

  // { [country]: [{date, spread}, ...] } — replaced wholesale on each fetch, so
  // a deselected country's points drop out without any cleanup step.
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Viewport auto-centring: 'init' until the effect below runs (which happens
  // right after mount, and again on every selectedDate change). Doubles as
  // Plotly's uirevision — while it stays the same value, Plotly preserves any
  // pan/zoom the user has done; when it changes, Plotly applies the new
  // xaxis.range (the centred window) once, then lets the user pan freely again.
  const [viewRevision, setViewRevision] = useState('init')
  // Visible x-window driving the y-axis fit: the user's current pan/zoom (set
  // from onRelayout), or null to fall back to the centred viewport.
  const [xRange, setXRange] = useState(null)
  useEffect(() => {
    // Snap the range to the smallest tier covering the picked date, every time
    // — widening for older dates, narrowing for newer ones. null means the date
    // is within the last year, so any current range already covers it; leave
    // `years` as-is in that case. Runs on mount too: SpreadChart fully
    // unmounts/remounts on every tab switch, so "on mount" and "on date
    // change" must behave the same or re-arriving at the tab shows a stale,
    // uncentred view.
    if (selectedDate) {
      const r = rangeForDate(selectedDate)
      if (r !== null) setYears(r)
    }
    // Drop any prior pan so the y-fit follows the new centred viewport.
    setXRange(null)
    setViewRevision(selectedDate)
    // Fire only on a date pick; `years` is read fresh from the closure on
    // purpose (adding it would re-run this on every range-button click).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  useEffect(() => {
    const countries = shownKey ? shownKey.split(',') : []
    if (!countries.length) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const from = fromForRange(years)
    Promise.all(countries.map((c) => fetchSpread(c, from, undefined)))
      .then((responses) => {
        if (cancelled) return
        setData(Object.fromEntries(responses.map((r, i) => [countries[i], r.data])))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shownKey, years])

  if (!shown.length) {
    return (
      <div
        className="text-muted"
        style={{ display: 'flex', height: 'var(--chart-h)', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
      >
        Select {SPREAD_COUNTRIES.slice(0, -1).join(', ')} or {SPREAD_COUNTRIES.at(-1)} to view the 2Y10Y spread chart
      </div>
    )
  }

  // One entry per selected+loaded country, in SPREAD_COUNTRIES order; drives both
  // the traces and the shared y-axis fit below. Colours come from the spec table
  // in constants.js, never a literal here.
  const series = shown
    .filter((c) => data[c])
    .map((c) => ({ country: c, color: COUNTRY_BY_NAME[c].color, points: data[c] }))
  const allPoints = series.flatMap((s) => s.points)
  const allDates = allPoints.map((p) => p.date)
  const from = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : fromForRange(years)
  const to = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString().slice(0, 10)

  // Force the centred window only once uirevision has actually changed (i.e.
  // the mount/date-change effect above has run) — see that effect. Clamp the
  // upper edge to the latest fetched date so centring on a recent date (e.g.
  // today) doesn't waste half the plot on empty future dates.
  const centerRange =
    viewRevision !== 'init' && selectedDate
      ? [addYears(selectedDate, -1), addYears(selectedDate, 1) < to ? addYears(selectedDate, 1) : to]
      : undefined

  // Plotly autoranges y to ALL loaded points, so a Max chart centred on recent
  // data scales to 1980s +3% spreads and looks flat. Fit y to just the points
  // inside the visible x-window: the user's pan (xRange) or the centred
  // viewport. `allPoints` is the flattened union of EVERY visible series, however
  // many there are, so the axis fits whichever line runs highest/lowest in view.
  // null on first load → let Plotly autorange the full series.
  const win = xRange ?? centerRange
  let yRange
  if (win && allPoints.length) {
    const lo = new Date(win[0]).getTime()
    const hi = new Date(win[1]).getTime()
    const ys = allPoints
      .filter((p) => {
        const t = new Date(p.date).getTime()
        return t >= lo && t <= hi
      })
      .map((p) => p.spread)
    if (ys.length) {
      const min = Math.min(...ys)
      const max = Math.max(...ys)
      const pad = (max - min) * 0.1 || 0.1
      yRange = [min - pad, max + pad]
    }
  }

  // Capture pan/zoom so the y-fit tracks it; ignore y-only relayouts (which our
  // own yaxis.range updates trigger) to avoid a feedback loop.
  function handleRelayout(e) {
    if (e['xaxis.autorange']) {
      setXRange(null)
      return
    }
    const lo = e['xaxis.range[0]']
    const hi = e['xaxis.range[1]']
    if (lo !== undefined && hi !== undefined) setXRange([lo, hi])
  }

  const layout = {
    // No Plotly title: the chart card renders its own <h2>. The date range that
    // used to live in the title is still shown, once, under the plot.
    font: { family: '"IBM Plex Mono", monospace', color: '#6B7280', size: 12 },
    dragmode: 'pan',
    uirevision: viewRevision,
    xaxis: {
      type: 'date',
      ...(centerRange ? { range: centerRange } : {}),
      showgrid: false,
      showline: true,
      linecolor: '#D8DCE3',
      ticks: '',
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: 'rgba(14, 154, 146, 0.35)',
      spikethickness: 1,
      spikedash: 'dot',
    },
    yaxis: {
      title: { text: 'SPREAD (%)', font: { size: 11, color: '#6B7280' } },
      ticksuffix: '%',
      // Own uirevision key: while the parent uirevision holds x-pan steady,
      // Plotly ignores a new yaxis.range unless this key changes — so bump it
      // whenever the fitted range does.
      ...(yRange
        ? { range: yRange, autorange: false, uirevision: `${yRange[0]},${yRange[1]}` }
        : { autorange: true, uirevision: viewRevision }),
      showgrid: true,
      gridcolor: 'rgba(11, 15, 20, 0.07)',
      showline: false,
      zeroline: false,
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: 'rgba(14, 154, 146, 0.35)',
      spikethickness: 1,
      spikedash: 'dot',
    },
    // Normal zone (above 0), inversion zone (below 0) red, split at the zero
    // reference line drawn in grey on top. Selected-date marker (if any)
    // drawn above everything, including the trace.
    shapes: [
      { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#C3C9D2', width: 1.5 }, layer: 'below' },
      ...(selectedDate
        ? [{
            type: 'line', xref: 'x', yref: 'paper', x0: selectedDate, x1: selectedDate, y0: 0, y1: 1,
            line: { color: 'rgba(14, 154, 146, 0.6)', width: 1.5, dash: 'dash' },
            layer: 'above',
          }]
        : []),
    ],
    annotations: selectedDate
      ? [{
          xref: 'x', yref: 'paper', x: selectedDate, y: 1, yanchor: 'bottom',
          text: shortMonth(selectedDate),
          showarrow: false,
          font: { family: '"IBM Plex Mono", monospace', size: 11, color: '#0E9A92' },
        }]
      : [],
    // Horizontal, below the plot — matching YieldChart. Plotly's default puts a
    // vertical legend top-right, directly underneath the modebar.
    legend: { orientation: 'h', y: -0.18, x: 0, font: { size: 11 } },
    // Set here rather than by CSS: with a transparent paper_bgcolor Plotly falls
    // back to its dark modebar theme, which no longer matches anything.
    modebar: {
      bgcolor: 'rgba(0, 0, 0, 0)',
      color: '#6B7280',
      activecolor: '#0E9A92',
    },
    hovermode: 'x',
    hoverlabel: {
      bgcolor: '#FFFFFF',
      bordercolor: '#D8DCE3',
      font: { family: '"IBM Plex Mono", monospace', color: '#0B0F14' },
    },
    // Transparent: the plot inherits the white card rather than sitting on its
    // own panel.
    plot_bgcolor: 'rgba(0, 0, 0, 0)',
    paper_bgcolor: 'rgba(0, 0, 0, 0)',
    margin: { l: 56, r: 24, t: 16, b: 64 },
    autosize: true,
    transition: {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
      easing: 'cubic-in-out',
    },
  }

  // One trace per country, coloured by its spec colour. Per-point hover payload
  // is [bps, coloured status label]; Plotly renders the <span style> pseudo-HTML
  // in hovertemplate so the label tints itself. `name` labels which country's
  // line a point belongs to in the shared (hovermode 'x') tooltip.
  const traces = series.map((s) => ({
    type: 'scatter',
    mode: 'lines',
    name: `${s.country} 2Y10Y`,
    x: s.points.map((d) => d.date),
    y: s.points.map((d) => d.spread),
    customdata: s.points.map((d) => {
      const b = Math.round(d.spread * 100)
      const status =
        d.spread < 0
          ? '<span style="color:#D32F3C">Inverted</span>'
          : '<span style="color:#0A8F55">Normal</span>'
      return [b, status]
    }),
    line: { color: s.color, width: 2.25 },
    hovertemplate:
      '%{fullData.name}<br>Date: %{x|%d %b %Y}<br>Spread: %{customdata[0]} bps<br>%{customdata[1]}<extra></extra>',
  }))

  return (
    <div>
      {hasUnsupported && (
        <p className="text-muted" style={{ margin: '0 0 var(--space-2)', fontSize: 11 }}>
          Spread data available for {SPREAD_COUNTRIES.slice(0, -1).join(', ')} and{' '}
          {SPREAD_COUNTRIES.at(-1)} only. Other countries coming soon.
        </p>
      )}
      <p className="text-muted" style={{ margin: '0 0 var(--space-2)', fontSize: 11 }}>
        Below zero = inverted curve. Historically precedes recessions.
      </p>
      {selectedDate && (
        <p className="text-muted" style={{ margin: '0 0 16px', fontSize: 11 }}>
          Viewing: {formatDate(selectedDate)}
        </p>
      )}

      <div className="plot-inset">
        {loading && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-surface-1) 72%, transparent)',
              backdropFilter: 'blur(1px)',
            }}
          >
            <span className="blink" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>
              LOADING…
            </span>
          </div>
        )}
        {error ? (
          <div className="text-muted" style={{ display: 'flex', height: 'var(--chart-h)', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
            Couldn’t reach the data service. Try again in a moment.
          </div>
        ) : (
          <Plot
            data={traces}
            layout={layout}
            onRelayout={handleRelayout}
            config={{
              responsive: true,
              scrollZoom: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            }}
            useResizeHandler
            style={{ width: '100%', height: 'var(--chart-h)' }}
          />
        )}
      </div>

      {/* The span the plot covers. Used to live in the Plotly title, which the
          card's own <h2> replaced. */}
      <p
        className="text-muted"
        style={{ margin: '12px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)' }}
      >
        {shown.join(' · ')} — {from} to {to}
      </p>
    </div>
  )
}
