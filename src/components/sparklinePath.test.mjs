import assert from 'node:assert'
import { scaleToPath } from './sparklinePath.js'

assert.equal(scaleToPath([], 100, 30), '')
assert.equal(scaleToPath([{ value: 1 }], 100, 30), '')
assert.equal(scaleToPath([{ value: 1 }, { value: 1 }], 100, 30), 'M2.0,28.0 L98.0,28.0')
assert.equal(scaleToPath([{ value: 0 }, { value: 1 }], 10, 10), 'M2.0,8.0 L8.0,2.0')
console.log('ok')
