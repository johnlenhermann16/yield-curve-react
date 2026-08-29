import assert from 'node:assert'
import { classifyShape, groupByShape } from './curveShape.js'

assert.equal(classifyShape(null), null)
assert.equal(classifyShape({ '2Y': 4, '10Y': 4.5 }), 'normal')
assert.equal(classifyShape({ '2Y': 4.5, '10Y': 4 }), 'inverted')
assert.equal(classifyShape({ '2Y': 4, '10Y': 4.1 }), 'flat')
assert.equal(classifyShape({ '1M': 4, '2Y': 5, '10Y': 4 }), 'humped')

// Two dates, different shapes -> two groups, each keeping its own date.
const results = [
  { date: '2026-01-01', countryData: { US: { yields: { '2Y': 4, '10Y': 4.5 } } } },
  { date: '2020-06-01', countryData: { US: { yields: { '2Y': 4.5, '10Y': 4 } } } },
]
const groups = groupByShape(results, 'US')
assert.equal(groups.length, 2)
assert.deepEqual(groups[0], { shape: 'normal', dates: ['2026-01-01'] })
assert.deepEqual(groups[1], { shape: 'inverted', dates: ['2020-06-01'] })

// Two dates, same shape -> merged into one group with both dates.
const sameShape = [
  { date: '2026-01-01', countryData: { US: { yields: { '2Y': 4, '10Y': 4.5 } } } },
  { date: '2026-02-01', countryData: { US: { yields: { '2Y': 4.1, '10Y': 4.6 } } } },
]
const merged = groupByShape(sameShape, 'US')
assert.equal(merged.length, 1)
assert.deepEqual(merged[0], { shape: 'normal', dates: ['2026-01-01', '2026-02-01'] })

// Missing data for a date is skipped, not classified as a shape.
const withGap = [
  { date: '2026-01-01', countryData: { US: { yields: { '2Y': 4, '10Y': 4.5 } } } },
  { date: '1999-01-01', countryData: {} },
]
assert.deepEqual(groupByShape(withGap, 'US'), [{ shape: 'normal', dates: ['2026-01-01'] }])

console.log('ok')
