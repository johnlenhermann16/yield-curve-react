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
          opacity: MARKER_OPACITY_BY_POSITION[pos] ?? 1,
          marker: {
            symbol: 'diamond',
            size: 11,
            color,
            line: { color: '#FFFFFF', width: 1.5 },
          },
          hovertemplate: `<b>${label}</b><br>%{x} · %{y:.2f}%<extra></extra>`,
        }
      }

      // Flat, unfilled lines only — a decorative area wash under the primary
      // trace isn't honest to a data-ink terminal aesthetic.
      return {
        type: 'scatter',
        mode: 'lines+markers',
        name: label,
        x,
        y,
        opacity: MARKER_OPACITY_BY_POSITION[pos] ?? 1,
        line: {
          // 2.25 rather than 2: Spain (#eda100) and Canada (#e87ba4) sit under
          // 3:1 against white, and stroke weight is the one lever available —
          // the country colours themselves are fixed by spec.
          color,
          width: 2.25,
          shape: 'linear',
          dash: DASH_BY_POSITION[pos] ?? 'solid',
        },
        marker: { size: 5, color, line: { color: '#FFFFFF', width: 1.25 } },
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
    // 5%, not the dark theme's 14%. These bands cover large areas, and on white
    // the same red reads as a slab rather than a tint — it has to sit well below
    // the lines it annotates.
    fillcolor: 'rgba(211, 47, 60, 0.05)',
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
      line: { color: '#C3C9D2', width: 1.5, dash: 'dash' },
      layer: 'below',
    })
    annotations.push({
      xref: 'paper', yref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom',
      text: `${event.name} · ${event.date}`,
      hovertext: event.desc,
      font: { family: '"IBM Plex Mono", monospace', size: 10, color: '#6B7280' },
      showarrow: false,
    })
  }

  const layout = {
    // No Plotly title: the chart card renders its own <h2> above this, and two
    // titles stacked is the kind of duplication the redesign is removing.
    font: { family: '"IBM Plex Mono", monospace', color: '#6B7280', size: 12 },
    xaxis: {
      title: { text: 'MATURITY', font: { size: 11, color: '#6B7280' } },
      type: 'category',
      categoryorder: 'array',
      categoryarray: order,
      showgrid: false,
      showline: true,
      linecolor: '#D8DCE3',
      // Tick marks dropped — the labels sit close enough to read without them.
      ticks: '',
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: 'rgba(14, 154, 146, 0.35)',
      spikethickness: 1,
      spikedash: 'dot',
    },
    yaxis: {
      title: { text: 'YIELD (%)', font: { size: 11, color: '#6B7280' } },
      ticksuffix: '%',
      showgrid: true,
      gridcolor: 'rgba(11, 15, 20, 0.07)',
      showline: false,
      zeroline: false,
    },
    shapes,
    annotations,
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0,
      font: { size: 11 },
    },
    // Set here rather than by CSS: with a transparent paper_bgcolor Plotly
    // falls back to its dark modebar theme, which no longer matches anything.
    modebar: {
      bgcolor: 'rgba(0, 0, 0, 0)',
      color: '#6B7280',
      activecolor: '#0E9A92',
    },
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: '#FFFFFF',
      bordercolor: '#D8DCE3',
      font: { family: '"IBM Plex Mono", monospace', color: '#0B0F14' },
    },
    // Transparent: the plot inherits the white card rather than sitting on its
    // own panel. Nothing in index.css needs to stay in sync with a colour here
    // any more — that was the old dark inset's constraint.
    plot_bgcolor: 'rgba(0, 0, 0, 0)',
    paper_bgcolor: 'rgba(0, 0, 0, 0)',
    // t: 16 put the modebar right on top of the highest gridline; Spread
    // avoids this because its y-range always has extra data padding above
    // the top trace. Yield Curve's doesn't, so give the modebar its own room.
    margin: { l: 56, r: 24, t: 36, b: 64 },
    autosize: true,
    transition: {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
      easing: 'cubic-in-out',
    },
  }

  const config = {
    displayModeBar: true,
    scrollZoom: true,
    responsive: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      useResizeHandler
      style={{ width: '100%', height: 'var(--chart-h)' }}
    />
  )
}
