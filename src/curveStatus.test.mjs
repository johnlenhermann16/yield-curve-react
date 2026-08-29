import assert from 'node:assert'
import { curveStatus } from './curveStatus.js'

assert.equal(curveStatus(null), null)
assert.equal(curveStatus(0.5), 'Normal')
assert.equal(curveStatus(-0.5), 'Inverted')
assert.equal(curveStatus(0.1), 'Flat')
assert.equal(curveStatus(-0.15), 'Flat')
console.log('ok')
