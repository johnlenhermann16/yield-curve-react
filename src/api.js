import axios from 'axios'
import { API_URL } from './constants'

// Fetch yield-curve data for the given countries on a single date. The API
// returns { date, countries: { <name>: { actual_date, yields, error } } } and
// never fails the whole request over one bad country, so callers inspect each
// country's payload individually.
export async function fetchYields(countryNames, date) {
  const countries = countryNames.join(',')
  const res = await axios.get(`${API_URL}/api/yields`, {
    params: { countries, date },
  })
  return res.data
}

// Fetch the US 2Y10Y spread (FRED T10Y2Y) as { country, data: [{ date, spread }] }.
// `from`/`to` are optional ISO dates; omit to let the API default to last 4 years.
export async function fetchSpread(country, from, to) {
  const res = await axios.get(`${API_URL}/api/spread`, {
    params: { country, from, to },
  })
  return res.data
}

// Returns { date, title, description, color } for the historical period a date
// falls in. `color` (red/orange/blue) is chosen server-side per the period.
export async function fetchHistoricalContext(date) {
  const res = await axios.get(`${API_URL}/api/historical-context`, {
    params: { date },
  })
  return res.data
}
