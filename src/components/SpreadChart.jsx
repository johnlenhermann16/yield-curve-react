import { useEffect, useRef, useState } from 'react'
import Plot from 'react-plotly.js'
import { fetchSpread } from '../api'
import { shortMonth } from '../events'
import { COUNTRY_BY_NAME, SPREAD_COUNTRIES } from '../constants'

const MAX_FROM = '1976-06-01' // T10Y2Y series start on FRED
const RANGES = [
  { label: '1Y', years: 1 },
  { label: '2Y', years: 2 },
  { label: '4Y', years: 4 },
  { label: '10Y', years: 10 },
  { label: 'Max', years: 'max' },
]

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
export default function SpreadChart({ selected, selectedDate }) {
  const shown = SPREAD_COUNTRIES.filter((c) => selected.includes(c))
  const hasUnsupported = selected.some((c) => !SPREAD_COUNTRIES.includes(c))
  // Stable dep for the fetch effect: `shown` is a fresh array every render, so
  // using it directly would re-fire the effect forever.
  const shownKey = shown.join(',')

  const [years, setYears] = useState(4)
  // { [country]: [{date, spread}, ...] } — replaced wholesale on each fetch, so
  // a deselected country's points drop out without any cleanup step.
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Viewport auto-centring: 'init' until the primary date actually changes, so
  // first load keeps the plain 4Y default range instead of jumping. Doubles as
  // Plotly's uirevision — while it stays the same value, Plotly preserves any
  // pan/zoom the user has done; when it changes, Plotly applies the new
  // xaxis.range (the centred window) once, then lets the user pan freely again.
  const [viewRevision, setViewRevision] = useState('init')
  // Visible x-window driving the y-axis fit: the user's current pan/zoom (set
  // from onRelayout), or null to fall back to the centred viewport.
  const [xRange, setXRange] = useState(null)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    // Snap the range to the smallest tier covering the picked date, every time
    // — widening for older dates, narrowing for newer ones. null means the date
    // is within the last year, so any current range already covers it; leave
    // `years` as-is in that case.
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
        style={{ display: 'flex', height: 520, alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
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
  // not on first mount) — see the effect above.
  const centerRange =
    viewRevision !== 'init' && selectedDate
      ? [addYears(selectedDate, -1), addYears(selectedDate, 1)]
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
    title: {
      text: `${shown.join(' & ')} 2Y10Y Spread — ${from} to ${to}`,
      font: { family: 'Barlow Condensed, sans-serif', size: 24, color: '#1f2023' },
      x: 0,
      xanchor: 'left',
      pad: { l: 4 },
    },
    font: { family: 'Barlow, sans-serif', color: '#4b4f55', size: 14 },
    dragmode: 'pan',
    uirevision: viewRevision,
    xaxis: {
      type: 'date',
      ...(centerRange ? { range: centerRange } : {}),
      showgrid: false,
      showline: true,
      linecolor: '#e2e2e4',
      ticks: 'outside',
      tickcolor: '#e2e2e4',
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: 'rgba(89, 128, 166, 0.4)',
      spikethickness: 1,
      spikedash: 'dot',
    },
    yaxis: {
      title: { text: 'Spread (%)', font: { size: 13, color: '#6b7075' } },
      ticksuffix: '%',
      // Own uirevision key: while the parent uirevision holds x-pan steady,
      // Plotly ignores a new yaxis.range unless this key changes — so bump it
      // whenever the fitted range does.
      ...(yRange
        ? { range: yRange, autorange: false, uirevision: `${yRange[0]},${yRange[1]}` }
        : { autorange: true, uirevision: viewRevision }),
      showgrid: true,
      gridcolor: '#eeeef0',
      zeroline: false,
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: 'rgba(89, 128, 166, 0.4)',
      spikethickness: 1,
      spikedash: 'dot',
    },
    // Normal zone (above 0) light blue, inversion zone (below 0) red, split at
    // the zero reference line drawn in grey on top. Selected-date marker (if
    // any) drawn above everything, including the trace.
    shapes: [
      { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#98989b', width: 1.5 }, layer: 'below' },
      ...(selectedDate
        ? [{
            type: 'line', xref: 'x', yref: 'paper', x0: selectedDate, x1: selectedDate, y0: 0, y1: 1,
            line: { color: 'rgba(89, 128, 166, 0.6)', width: 1.5, dash: 'dash' },
            layer: 'above',
          }]
        : []),
    ],
    annotations: selectedDate
      ? [{
          xref: 'x', yref: 'paper', x: selectedDate, y: 1, yanchor: 'bottom',
          text: shortMonth(selectedDate),
          showarrow: false,
          font: { family: 'Barlow Condensed, sans-serif', size: 12, color: '#5980a6' },
        }]
      : [],
    hovermode: 'x',
    hoverlabel: { font: { family: 'Barlow, sans-serif' } },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    margin: { l: 60, r: 24, t: 56, b: 48 },
    autosize: true,
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
          ? '<span style="color:#c0392b">Inverted</span>'
          : '<span style="color:#2a78d6">Normal</span>'
      return [b, status]
    }),
    line: { color: s.color, width: 2 },
    hovertemplate:
      '%{fullData.name}<br>Date: %{x|%d %b %Y}<br>Spread: %{customdata[0]} bps<br>%{customdata[1]}<extra></extra>',
  }))

  return (
    <div>
      {hasUnsupported && (
        <p className="text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 12 }}>
          Spread data available for {SPREAD_COUNTRIES.slice(0, -1).join(', ')} and{' '}
          {SPREAD_COUNTRIES.at(-1)} only. Other countries coming soon.
        </p>
      )}
      <p className="text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 12 }}>
        Below zero = inverted curve. Historically precedes recessions.
      </p>
      {selectedDate && (
        <p className="text-muted" style={{ margin: '0 0 var(--space-2)', fontSize: 11 }}>
          Viewing: {formatDate(selectedDate)}
        </p>
      )}

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
            <div className="text-muted" style={{ fontSize: 13 }}>Loading spread…</div>
          </div>
        )}
        {error ? (
          <div className="text-muted" style={{ display: 'flex', height: 520, alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
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
            style={{ width: '100%', height: '520px' }}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        {RANGES.map((r) => (
          <button
            key={r.years}
            type="button"
            onClick={() => setYears(r.years)}
            className="btn"
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 14,
              padding: '4px 12px',
              background: years === r.years ? 'var(--color-accent)' : 'transparent',
              color: years === r.years ? '#fff' : 'var(--color-text)',
              border: years === r.years ? '1px solid var(--color-accent)' : '1px solid var(--color-divider)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
