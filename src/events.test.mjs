// node src/events.test.mjs — guards the past-facing 180-day window.
import assert from 'node:assert'
import { nearestEvent } from './events.js'

// Default date sits 56 days BEFORE SVB and 303 days after Fed hiking → nothing.
assert.equal(nearestEvent('2023-01-13'), null)
// Day after Lehman → Lehman.
assert.equal(nearestEvent('2008-09-16').name, 'Lehman Brothers collapse')
// Exactly on the event date counts.
assert.equal(nearestEvent('2020-03-16').name, 'COVID crash')
// 181 days after COVID → out of window.
assert.equal(nearestEvent('2020-09-14'), null)
// After SVB → most recent event wins over earlier ones still in range.
assert.equal(nearestEvent('2023-03-20').name, 'SVB failure')
console.log('ok')
