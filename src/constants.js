// Country configuration — colours are fixed by the project spec and must match
// exactly. `tenYearOnly` countries only return a single 10Y point and are drawn
// as diamond markers rather than a line.
export const COUNTRIES = [
  { name: 'US', color: '#2a78d6' },
  { name: 'UK', color: '#eb6834' },
  { name: 'Germany', color: '#4a3aa7' },
  { name: 'France', color: '#f04e2e', tenYearOnly: true }, // shifted off #e34948 to separate from Japan's crimson
  { name: 'Italy', color: '#008300', tenYearOnly: true },
  { name: 'Spain', color: '#eda100', tenYearOnly: true },
  { name: 'Canada', color: '#e87ba4' },
  { name: 'Switzerland', color: '#a15c2e' },
  { name: 'Japan', color: '#c0392b' },
]

export const COUNTRY_BY_NAME = Object.fromEntries(
  COUNTRIES.map((c) => [c.name, c]),
)

// Countries /api/spread can serve a 2Y10Y series for. Add a name here once the
// backend supports it — SpreadChart derives its traces, title, y-fit and
// empty/unsupported notices from this list, so nothing else needs changing.
export const SPREAD_COUNTRIES = ['US', 'UK', 'Germany']

// Spread-chart lookback tiers. Lives here rather than in SpreadChart because the
// range buttons render on App's chart tab rail while the state they drive is
// consumed by SpreadChart.
export const RANGES = [
  { label: '1Y', years: 1 },
  { label: '2Y', years: 2 },
  { label: '4Y', years: 4 },
  { label: '10Y', years: 10 },
  { label: 'Max', years: 'max' },
]

// Canonical maturity ordering, short → long. The x-axis is categorical and
// always renders in this order.
export const MATURITIES = [
  '1M',
  '3M',
  '6M',
  '1Y',
  '2Y',
  '3Y',
  '5Y',
  '7Y',
  '10Y',
  '20Y',
  '30Y',
]

export const DEFAULT_DATE = '2023-01-13'
