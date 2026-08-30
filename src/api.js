// Reads sovereign yield/spread data directly from Supabase via PostgREST
// (plain fetch — no supabase-js). RLS grants anon SELECT only, so every
// request here is a read.
import { getHistoricalContext } from './historicalContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const REST_URL = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

// PostgREST/Supabase hard-caps rows per request at 1000 (db.max_rows) — a
// `limit` above that is silently clamped, it does not error. Confirmed
// against this project: spread_observations has 12k+ rows for US alone, so
// the "Max" range button would silently truncate to the most recent 1000
// rows without pagination.
const PAGE_SIZE = 1000

// `params` values may be a string (single filter) or an array of strings
// (repeated query keys — PostgREST ANDs multiple filters on the same
// column, e.g. observation_date=gte.X&observation_date=lte.Y).
function buildUrl(table, params) {
  const url = new URL(`${REST_URL}/${table}`)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, v)
    }
  }
  return url
}

async function fetchRows(table, params) {
  const res = await fetch(buildUrl(table, params), { headers: HEADERS })
  if (!res.ok) {
    throw new Error(`Supabase ${table} query failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Paginates past the 1000-row server cap for queries that can return more
// than that (spread ranges over several years). Relies on the caller's
// `params.order` for a stable row sequence across pages.
async function fetchAllRows(table, params) {
  const rows = []
  let offset = 0
  while (true) {
    const page = await fetchRows(table, { ...params, limit: PAGE_SIZE, offset })
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
    offset += PAGE_SIZE
  }
}

// The date picker (Dashboard.jsx) allows any calendar day, including weekends and
// holidays the bond market has no observation for. Resolve to the latest
// trading-day observation on or before the requested date, per country
// (different markets close on different days), the same "actual_date"
// fallback the old Railway API did.
async function latestObservedDate(country, date) {
  const rows = await fetchRows('yield_observations', {
    country: `eq.${country}`,
    observation_date: `lte.${date}`,
    select: 'observation_date',
    order: 'observation_date.desc',
    limit: 1,
  })
  return rows[0]?.observation_date ?? null
}

async function fetchCountryYieldCurve(country, date) {
  const actualDate = await latestObservedDate(country, date)
  if (!actualDate) {
    return { actual_date: null, yields: {}, error: 'No data available on or before this date' }
  }
  const rows = await fetchRows('yield_observations', {
    country: `eq.${country}`,
    observation_date: `eq.${actualDate}`,
    select: 'maturity,yield_pct',
  })
  const yields = {}
  for (const row of rows) yields[row.maturity] = row.yield_pct
  return { actual_date: actualDate, yields, error: null }
}

// Fetch yield curves for several countries on one date. Mirrors the old API's
// { date, countries: { <name>: { actual_date, yields, error } } } shape;
// callers inspect each country's payload individually rather than the whole
// request failing over one bad country.
export async function fetchYields(countryNames, date) {
  const entries = await Promise.all(
    countryNames.map(async (name) => {
      try {
        return [name, await fetchCountryYieldCurve(name, date)]
      } catch (err) {
        return [name, { actual_date: null, yields: {}, error: err.message }]
      }
    }),
  )
  return { date, countries: Object.fromEntries(entries) }
}

// Fetch one country's yield curve across several dates (multi-date
// comparison). Returns [{ date, actual_date, yields, error }, ...] in the
// same order as `dates`.
export async function fetchYieldsForDates(country, dates) {
  return Promise.all(
    dates.map(async (date) => {
      try {
        const curve = await fetchCountryYieldCurve(country, date)
        return { date, ...curve }
      } catch (err) {
        return { date, actual_date: null, yields: {}, error: err.message }
      }
    }),
  )
}

// Previous trading-day observation strictly before `date` — the comparison
// point for the top stat row's bp-delta badges. Mirrors latestObservedDate's
// "one row, ordered desc" trick, just with a strict `lt` filter.
async function previousObservedDate(country, date) {
  const rows = await fetchRows('yield_observations', {
    country: `eq.${country}`,
    observation_date: `lt.${date}`,
    select: 'observation_date',
    order: 'observation_date.desc',
    limit: 1,
  })
  return rows[0]?.observation_date ?? null
}

// Yields for the trading day before `actualDate` — pass the already-resolved
// actual_date from a prior fetchYields call, not the raw picked date, so this
// doesn't re-resolve the primary date's own trading day a second time.
export async function fetchPreviousYields(country, actualDate) {
  if (!actualDate) return { yields: {}, actual_date: null }
  const prevDate = await previousObservedDate(country, actualDate)
  if (!prevDate) return { yields: {}, actual_date: null }
  const rows = await fetchRows('yield_observations', {
    country: `eq.${country}`,
    observation_date: `eq.${prevDate}`,
    select: 'maturity,yield_pct',
  })
  const yields = {}
  for (const row of rows) yields[row.maturity] = row.yield_pct
  return { yields, actual_date: prevDate }
}

// One country/maturity's yield over a date range, e.g. for a sparkline —
// mirrors fetchSpread's exact shape/pagination pattern against
// yield_observations instead of spread_observations.
export async function fetchYieldHistory(country, maturity, from, to) {
  const dateFilters = []
  if (from) dateFilters.push(`gte.${from}`)
  if (to) dateFilters.push(`lte.${to}`)

  const rows = await fetchAllRows('yield_observations', {
    country: `eq.${country}`,
    maturity: `eq.${maturity}`,
    ...(dateFilters.length ? { observation_date: dateFilters } : {}),
    select: 'observation_date,yield_pct',
    order: 'observation_date.asc',
  })

  return {
    country,
    maturity,
    data: rows.map((row) => ({ date: row.observation_date, yield: row.yield_pct })),
  }
}

// Fetch a country's 2Y10Y spread over a date range as
// { country, data: [{ date, spread }] }. `from`/`to` are optional ISO dates;
// an omitted `to` leaves the range open-ended (up to the latest observation).
export async function fetchSpread(country, from, to) {
  const dateFilters = []
  if (from) dateFilters.push(`gte.${from}`)
  if (to) dateFilters.push(`lte.${to}`)

  const rows = await fetchAllRows('spread_observations', {
    country: `eq.${country}`,
    ...(dateFilters.length ? { observation_date: dateFilters } : {}),
    select: 'observation_date,spread_pct',
    order: 'observation_date.asc',
  })

  return {
    country,
    data: rows.map((row) => ({ date: row.observation_date, spread: row.spread_pct })),
  }
}

// Historical-context copy (period title/description/color) is a static
// lookup by year, not Supabase-backed data — see historicalContext.js.
export async function fetchHistoricalContext(date) {
  return { date, ...getHistoricalContext(date) }
}
