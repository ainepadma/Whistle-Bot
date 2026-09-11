const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const messages = [], frames = [], notes = [], hostListeners = [], windowListeners = {}
let clock = 0
const element = () => ({
  hidden: true, dataset: {}, style: {}, classList: { add() {}, remove() {} },
  addEventListener() {}, setAttribute() {},
  getBoundingClientRect: () => ({ left: 70, top: 160, width: 100, height: 100 }),
})
const bot = element(), stage = element(), tooltip = element(), eyes = [element(), element()]
stage.clientWidth = 200
stage.clientHeight = 270
stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 270 })
stage.querySelectorAll = () => notes
stage.appendChild = note => notes.push(note)
const shape = {
  getTotalLength: () => 100,
  getPointAtLength: length => ({
    x: 100 + 30 * Math.cos(length * Math.PI / 50),
    y: 200 + 30 * Math.sin(length * Math.PI / 50),
    matrixTransform(matrix) { return { x: this.x + matrix.e, y: this.y + matrix.f } },
  }),
  getScreenCTM: () => ({ e: 10, f: 20 }),
}
const elements = { '#bot': bot, '#stage': stage, '#pet-tooltip': tooltip, '#shape-body-path': shape, '#eye-0': eyes[0], '#eye-1': eyes[1] }
const context = {
  GROKBOT_ORIGINAL: { EXPRESSIONS: [[[[100, 100], [110, 100], [105, 110]], [[120, 100], [130, 100], [125, 110]]]], POOLS: {} },
  document: {
    querySelector: selector => elements[selector], documentElement: { style: { setProperty() {} } },
    createElement: () => ({ ...element(), remove() {} }), addEventListener() {},
  },
  chrome: { webview: { postMessage: message => messages.push(message), addEventListener: (_, listener) => hostListeners.push(listener) } },
  performance: { now: () => clock },
  requestAnimationFrame: callback => frames.push(callback),
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  addEventListener: (name, callback) => { windowListeners[name] = callback },
  location: { search: '?size=200' }, URLSearchParams, innerWidth: 200, innerHeight: 270,
}
context.window = context
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../PetApp/wwwroot/pet.js'), 'utf8'), context)
function frame(time) {
  clock = time
  const pending = frames.splice(0)
  pending.forEach(callback => callback(time))
}
function regions() { return messages.filter(message => message.type === 'pet-region') }
frame(0)
assert.equal(regions().length, 1)
assert.equal(regions()[0].polygon.length, 64)
assert.equal(JSON.stringify(regions()[0].polygon[0]), '[140,220]', 'use the actual SVG screen transform')
frame(10)
frame(60)
assert.equal(regions().length, 1, 'unchanged geometry and closely spaced frames must not flood the host')
hostListeners[0]({ data: { type: 'request-region' } })
assert.equal(regions().length, 2, 'host DPI changes can force a fresh region')
hostListeners[0]({ data: { type: 'typing', key: 65 } })
const withNote = regions().at(-1)
assert.equal(notes.length, 1)
assert.equal(withNote.rects.length, 2, 'the tooltip and flying note both retain their visual area')
assert.ok(withNote.rects[0][3] > 100, 'retain the full note flight envelope, not only its current glyph bounds')
context.innerWidth = 300
context.innerHeight = 405
windowListeners.resize()
assert.equal(regions().at(-1).width, 300)
assert.equal(regions().at(-1).height, 405)
console.log('Pet region bridge acceptance: 8 passed, 0 failed')
