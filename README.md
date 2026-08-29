# Yield Curve Explorer

An interactive visualizer for sovereign bond yield curves and 2Y10Y spreads across nine countries, built with React and Plotly.

## Features

- **Yield curve chart** — plots the full maturity curve (1M–30Y) for any date, per country. France, Italy, and Spain report 10Y-only data and are drawn as single diamond markers instead of a line.
- **2Y10Y spread chart** — historical spread over configurable lookback windows (1Y/2Y/4Y/10Y/Max) for US, UK, and Germany.
- **Historical context** — surfaces relevant macro/rate-cycle context alongside the selected date.
- **Curve explainer** — a short primer on how to read a yield curve.
- Date picker resolves to the latest trading-day observation on or before the chosen date, per country, so weekends/holidays don't produce empty results.

Countries covered: US, UK, Germany, France, Italy, Spain, Canada, Switzerland, Japan.

## Stack

- React 19 + Vite
- Tailwind CSS 4
- Plotly.js (`react-plotly.js`) for charts
- Supabase (Postgres + PostgREST) as the data source — queried directly from the client with a read-only anon key scoped by row-level security

## Setup

```bash
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

`VITE_SUPABASE_ANON_KEY` is the public/anon key, not a service key — safe to expose client-side as long as RLS restricts it to `SELECT` on the yield/spread tables.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build locally
