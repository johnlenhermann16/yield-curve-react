import Plot from 'react-plotly.js'
import { MATURITIES, COUNTRY_BY_NAME } from '../constants'
import { nearestEvent } from '../events'

// Line style is fixed by date position, not country: 1st solid, 2nd dashed,
// 3rd dotted. Diamond-only countries can't show a dash, so they fade instead.
const DASH_BY_POSITION = ['solid', 'dash', 'dot']
const MARKER_OPACITY_BY_POSITION = [1, 0.55, 0.35]

// Ordered maturities that actually appear across every dated series.
function presentMaturities(series) {
  const seen = new Set()
  for (const { countryData } of series) {
    for (const payload of Object.values(countryData)) {
      for (const m of Object.keys(payload.yields || {})) seen.add(m)
    }
  }
  return MATURITIES.filter((m) => seen.has(m))
}

// Inversion bands: adjacent maturity segments where any drawn line curve (any
// country, any date) slopes downward.
function inversionBands(series, order) {
  const bands = []
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i]
    const b = order[i + 1]
    let inverted = false
    outer: for (const { countryData } of series) {
      for (const [name, payload] of Object.entries(countryData)) {
        if (COUNTRY_BY_NAME[name]?.tenYearOnly) continue
        const y = payload.yields || {}
        if (a in y && b in y && y[a] > y[b]) {
          inverted = true
          break outer
        }
      }
    }
    if (inverted) bands.push([i, i + 1])
  }
  return bands
}

export default function YieldChart({ series, primaryDate }) {
  // series: [{ date, countryData: { <name>: { yields, ... } } }] in date-picker
  // order. Position 0 is the primary (solid) date.
  const order = presentMaturities(series)

  const traces = series.flatMap(({ date, countryData }, pos) =>
    Object.entries(countryData).map(([name, payload]) => {
      const cfg = COUNTRY_BY_NAME[name]
      const color = cfg?.color ?? '#666'
      const maturities = order.filter((m) => m in payload.yields)
      const x = maturities
      const y = maturities.map((m) => payload.yields[m])
      const label = `${name} · ${date}`

      if (cfg?.tenYearOnly) {
        return {
          type: 'scatter',
          mode: 'markers',
          name: label,
          x,
          y,
          marker: {
            symbol: 'diamond',
            size: 12,
            color,
            opacity: MARKER_OPACITY_BY_POSITION[pos] ?? 1,
            line: { color: 'white', width: 1 },
          },
          hovertemplate: `<b>${label}</b><br>%{x} · %{y:.2f}%<extra></extra>`,
        }
      }

      return {
        type: 'scatter',
        mode: 'lines+markers',
        name: label,
        x,
        y,
        line: {
          color,
          width: 2.5,
          shape: 'linear',
          dash: DASH_BY_POSITION[pos] ?? 'solid',
        },
        marker: { size: 6, color, opacity: MARKER_OPACITY_BY_POSITION[pos] ?? 1 },
        hovertemplate: `<b>${label}</b><br>%{x} · %{y:.2f}%<extra></extra>`,
      }
    }),
  )

  const bands = inversionBands(series, order)
  const shapes = bands.map(([i, j]) => ({
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: i,
    x1: j,
    y0: 0,
    y1: 1,
    fillcolor: 'rgba(200, 60, 60, 0.07)',
    line: { width: 0 },
    layer: 'below',
  }))

  // Event flag. The x-axis is maturity, not time, so there is no date position
  // to sit on — pin a subtle full-height dashed line + label to the plot's right
  // edge. Only appears when the primary date is within 180 days after an event.
  // ponytail: right-edge flag, not a data-positioned line — no time axis to use.
  const event = nearestEvent(primaryDate)
  const annotations = []
  if (event) {
    shapes.push({
      type: 'line', xref: 'paper', yref: 'paper',
      x0: 1, x1: 1, y0: 0, y1: 1,
      line: { color: '#98989b', width: 1.5, dash: 'dash' },
      layer: 'below',
    })
    annotations.push({
      xref: 'paper', yref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom',
      text: `${event.name} · ${event.date}`,
      hovertext: event.desc,
      font: { family: 'Barlow Condensed, sans-serif', size: 12, color: '#98989b' },
      showarrow: false,
    })
  }

  const titleDate =
    series.length === 1 ? ` — ${series[0].date}` : ''

  const layout = {
    title: {
      text: `Government Bond Yield Curves${titleDate}`,
      font: { family: 'Barlow Condensed, sans-serif', size: 24, color: '#1f2023' },
      x: 0,
      xanchor: 'left',
      pad: { l: 4 },
    },
    font: { family: 'Barlow, sans-serif', color: '#4b4f55', size: 14 },
    xaxis: {
      title: { text: 'Maturity', font: { size: 13, color: '#6b7075' } },
      type: 'category',
      categoryorder: 'array',
      categoryarray: order,
      showgrid: false,
      showline: true,
      linecolor: '#e2e2e4',
      ticks: 'outside',
      tickcolor: '#e2e2e4',
    },
    yaxis: {
      title: { text: 'Yield (%)', font: { size: 13, color: '#6b7075' } },
      ticksuffix: '%',
      showgrid: true,
      gridcolor: '#eeeef0',
      zeroline: false,
    },
    shapes,
    annotations,
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0,
      font: { size: 13 },
    },
    hovermode: 'closest',
    hoverlabel: { font: { family: 'Barlow, sans-serif' } },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    margin: { l: 60, r: 24, t: 56, b: 72 },
    autosize: true,
  }

  const config = { displayModeBar: false, responsive: true }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      useResizeHandler
      style={{ width: '100%', height: '520px' }}
    />
  )
}
