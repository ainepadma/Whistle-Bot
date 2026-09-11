const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// Run the shipped scripts unchanged. Only browser drawing, events and time are
// replaced, so interaction checks exercise the actual closure in pet.js.
const sourceRoot = path.join(__dirname, '../PetApp/wwwroot')
const kiteSource = fs.readFileSync(path.join(sourceRoot, 'kite-animation.js'), 'utf8')
const petSource = fs.readFileSync(path.join(sourceRoot, 'pet.js'), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
let passed = 0, failed = 0
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`) }
}

function harness({ reduced = false, withPet = false, host = true, width = 360, height = 480,
  canvasAvailable = true, modelSize = 100, color = '#2f86ed', sailLoaded = true, random = .25 } = {}) {
  let now = 0, nextId = 1
  let randomValue = random, randomCalls = 0
  const controlledMath = Object.create(Math)
  controlledMath.random = () => { randomCalls++; return randomValue }
  const timers = new Map(), frames = [], messages = [], drawCalls = []
  function eventTarget() {
    const listeners = new Map()
    return {
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, [])
        listeners.get(name).push(callback)
      },
      dispatch(name, args = {}) {
        const event = { button: 0, pointerId: 1, clientX: 180, clientY: 260,
          movementX: 0, movementY: 0, preventDefault() {}, ...args }
        for (const callback of listeners.get(name) || []) callback(event)
      },
    }
  }
  const context2d = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} })
      return (...args) => {
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key} received non-finite coordinate`)
        drawCalls.push({ method: key, args, alpha: target.globalAlpha,
          fillStyle: target.fillStyle, strokeStyle: target.strokeStyle })
      }
    },
    set(target, key, value) { target[key] = value; return true },
  })
  function element(tag = 'div') {
    const classes = new Set(), children = [], attributes = {}, style = { setProperty(name, value) { this[name] = value } }
    return {
      ...eventTarget(), tagName: tag, hidden: false, dataset: {}, style, children, attributes,
      className: '', textContent: '',
      classList: { add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
      setAttribute: (name, value) => { attributes[name] = value }, getAttribute: name => attributes[name],
      getBoundingClientRect: () => ({ left: 130, top: 205, width: 100, height: 100 }),
      appendChild(child) { children.push(child); child.parentElement = this; return child },
      remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1) },
      querySelectorAll(selector) { return selector === '.pet-note' ? children.filter(child => child.className.split(' ').includes('pet-note')) : [] },
      getContext: () => canvasAvailable ? context2d : null,
      closest() { return null },
    }
  }
  const stage = element(), bot = element(), tooltip = element(), eyes = [element(), element()]
  tooltip.hidden = true
  stage.clientWidth = width; stage.clientHeight = height
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: stage.clientWidth, height: stage.clientHeight })
  stage.setPointerCapture = () => {}; stage.hasPointerCapture = () => true; stage.releasePointerCapture = () => {}
  bot.closest = selector => selector.includes('#bot') ? bot : null
  const shape = {
    getAttribute: () => 'M 0 0 L 212 0 L 212 230 Z',
    getTotalLength: () => 100,
    getPointAtLength(length) {
      return { x: 180 + 35 * Math.cos(length * Math.PI / 50), y: 255 + 35 * Math.sin(length * Math.PI / 50),
        matrixTransform() { return { x: this.x, y: this.y } } }
    },
    getScreenCTM: () => ({}),
  }
  const elements = { '#bot': bot, '#stage': stage, '#pet-tooltip': tooltip,
    '#shape-body-path': shape, '#eye-0': eyes[0], '#eye-1': eyes[1] }
  const document = { ...eventTarget(), hidden: false, documentElement: element(),
    querySelector: selector => elements[selector], createElement: element }
  const styleValue = name => document.documentElement.style[name] ??
    ({ '--pet-size': `${modelSize}px`, '--pet-color': color }[name] || '')
  bot.getBoundingClientRect = () => {
    const size = parseFloat(styleValue('--pet-size'))
    return { left: (stage.clientWidth - size) / 2, top: stage.clientHeight - size - 50, width: size, height: size }
  }
  function timeout(callback, delay, interval = false) {
    const id = nextId++; timers.set(id, { callback, at: now + Math.max(0, Number(delay) || 0), interval: interval ? delay : 0 }); return id
  }
  const webview = { ...eventTarget(), postMessage: message => messages.push(plain(message)) }
  const context = { ...eventTarget(), document, Math: controlledMath, performance: { now: () => now },
    GROKBOT_ORIGINAL: { EXPRESSIONS: [[[[90, 100], [110, 100], [100, 120]], [[130, 100], [150, 100], [140, 120]]]], POOLS: {} },
    setTimeout: (callback, delay) => timeout(callback, delay), clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => timeout(callback, delay, true), clearInterval: id => timers.delete(id),
    requestAnimationFrame: callback => { frames.push(callback); return nextId++ },
    matchMedia: () => ({ matches: reduced }), devicePixelRatio: 1.5,
    getComputedStyle: () => ({ getPropertyValue: styleValue }),
    Path2D: class Path2D { constructor(data) { this.data = data } },
    Image: class Image { constructor() { this.complete = sailLoaded; this.naturalWidth = sailLoaded ? 1000 : 0 } },
    location: { search: '?size=200&behavior=standby' }, URLSearchParams,
    innerWidth: width, innerHeight: height,
  }
  if (host) context.chrome = { webview }
  context.window = context
  vm.createContext(context)
  vm.runInContext(kiteSource, context, { filename: 'kite-animation.js' })
  if (withPet) vm.runInContext(petSource, context, { filename: 'pet.js' })
  const advance = time => {
    assert.ok(time >= now, 'test clock must move forward')
    let turns = 0
    while (true) {
      let dueId = null, due = null
      for (const [id, timer] of timers) if (timer.at <= time && (!due || timer.at < due.at)) { dueId = id; due = timer }
      if (!due) break
      assert.ok(++turns < 10000, 'timer loop did not settle')
      now = due.at; timers.delete(dueId)
      if (due.interval) timers.set(dueId, { ...due, at: now + due.interval })
      due.callback()
    }
    now = time
  }
  const frame = time => { advance(time); frames.splice(0).forEach(callback => callback(now)) }
  const send = data => webview.dispatch('message', { data })
  const pointer = (surface, name, args = {}) => surface.dispatch(name, { target: bot, ...args })
  const click = (target = bot) => {
    pointer(stage, 'pointerdown', { target }); advance(now + 20)
    pointer(document, 'pointerup', { target: stage })
  }
  const doubleClick = (target = bot) => {
    click(target); advance(now + 90); click(target)
    pointer(stage, 'dblclick', { target: stage })
  }
  const acknowledge = () => { send({ type: 'kite-mode', active: true }); frame(now + 16); frame(now + 16) }
  return { context, stage, bot, tooltip, document, messages, drawCalls, frames, send, pointer, click, doubleClick,
    acknowledge, advance, frame, styleValue, get now() { return now },
    setRandom(value) { assert.ok(value >= 0 && value < 1); randomValue = value },
    get randomCalls() { return randomCalls },
    resize(nextWidth, nextHeight) {
      stage.clientWidth = context.innerWidth = nextWidth
      stage.clientHeight = context.innerHeight = nextHeight
      context.dispatch('resize')
    },
    create(onFinish) { return new context.BanyaoKiteAnimation({ stage, bot, onFinish }) },
    active: () => stage.classList.contains('kite-active'),
    canvas: () => stage.children.find(child => child.tagName === 'canvas'),
    modeMessages: () => messages.filter(message => message.type === 'kite-mode'),
  }
}

check('source model has 112 row whistles and three correctly placed large whistles', () => {
  const { whistles } = harness().context.BanyaoKiteAnimation.model
  assert.equal(whistles.length, 115)
  assert.deepEqual(Array.from({ length: 11 }, (_, row) => whistles.filter(w => w.row === row).length), [9, 10, 9, 10, 9, 10, 9, 10, 11, 12, 13])
  assert.deepEqual(plain(whistles.slice(-3).map(({ x, y, d }) => [x, y, d])), [[-.138, -.122, .079], [.145, -.122, .079], [.016, -.285, .136]])
})

check('silhouette retains the rectangle plus diamond union, including four recessed turns', () => {
  const outline = plain(harness().context.BanyaoKiteAnimation.model.outline)
  assert.deepEqual(outline, [[-.25, .5], [.25, .5], [.25, .25], [.5, 0], [.25, -.25], [.25, -.5], [-.25, -.5], [-.25, -.25], [-.5, 0], [-.25, .25]])
  const area = Math.abs(outline.reduce((sum, a, i) => { const b = outline[(i + 1) % outline.length]; return sum + a[0] * b[1] - b[0] * a[1] }, 0)) / 2
  assert.equal(area, .625, 'the two real sail panels have a .625-height-squared union')
})

check('normal and reduced timelines have finite bounded progress and exact completion', () => {
  const { timeline } = harness().context.BanyaoKiteAnimation.model
  for (const reduced of [false, true]) {
    const duration = reduced ? 4.6 : 10.4
    for (let time = 0; time < duration + .5; time += .07) {
      const state = timeline(time, reduced)
      for (const key of ['assemble', 'returning', 'reveal']) assert.ok(state[key] >= 0 && state[key] <= 1)
    }
    assert.equal(timeline(duration - .001, reduced).done, false)
    assert.equal(timeline(duration, reduced).done, true)
  }
})

check('settled Canvas rendering draws every actual whistle and keeps geometry inside the viewport', () => {
  const h = harness(), animation = h.create()
  assert.equal(animation.start(0), true)
  h.drawCalls.length = 0; animation.render(5000)
  assert.equal(h.drawCalls.filter(call => call.method === 'fill' && call.args[0] === animation.body).length, 115)
  assert.equal(h.canvas().dataset.phase, 'flying')
  for (const [x, y] of animation.hitRegion().polygon) assert.ok(x >= 0 && x <= 360 && y >= 0 && y <= 480)
})

check('kite sail is exactly 1.5 times the visible pet body at all three style sizes', () => {
  for (const modelSize of [100, 150, 200]) {
    const h = harness({ modelSize, reduced: true }), animation = h.create()
    animation.start(0); animation.render(1200)
    const expected = modelSize * 212 / 285 * 1.5
    assert.ok(Math.abs(Number(h.canvas().dataset.extent) - expected) < .001,
      `${modelSize}px model should have a ${expected}px kite sail; got ${h.canvas().dataset.extent}`)
    const xs = animation.hitRegion().polygon.map(point => point[0])
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - expected) < .001,
      'rendered sail outline must match the reported size')
  }
})

check('enlarging the native viewport does not enlarge the selected pet or kite', () => {
  for (const size of [200, 250, 300]) {
    const h = harness({ withPet: true, width: size, height: size + 70 })
    h.send({ type: 'size', size })
    const selectedSize = h.styleValue('--pet-size')
    assert.equal(selectedSize, `${size - 100}px`)
    h.doubleClick(); h.resize(size + 160, size + 260); h.acknowledge(); h.frame(h.now + 5000)
    assert.equal(h.active(), true)
    assert.equal(h.styleValue('--pet-size'), selectedSize, 'animation headroom must not change the selected style')
    const extent = Number(h.canvas().dataset.extent)
    assert.ok(Math.abs(extent - (size - 100) * 212 / 285 * 1.5) < .001)
    h.resize(size + 320, size + 420); h.frame(h.now + 16)
    assert.equal(h.styleValue('--pet-size'), selectedSize)
    assert.equal(Number(h.canvas().dataset.extent), extent)
  }
})

check('all ten menu colors render as the actual flat whistle body color', () => {
  const colors = ['#9a6737', '#ff3347', '#ff6a00', '#ff9800', '#08c77a',
    '#08b9a9', '#2f86ed', '#8656f6', '#ff2d8b', '#2b2b2b']
  for (const color of colors) {
    const h = harness({ color }), animation = h.create()
    animation.start(0); h.drawCalls.length = 0; animation.render(5000)
    const bodyFills = h.drawCalls.filter(call => call.method === 'fill' && call.args[0] === animation.body)
    assert.equal(bodyFills.length, 115)
    assert.ok(bodyFills.every(call => call.fillStyle === color), `${color} must reach every whistle body fill`)
  }
})

check('changing style color during playback immediately recolors the rendered whistles', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.acknowledge(); h.frame(h.now + 5000)
  for (const color of ['#ff3347', '#08c77a', '#2b2b2b']) {
    h.send({ type: 'set-color', color }); h.drawCalls.length = 0; h.frame(h.now + 16)
    assert.equal(h.active(), true)
    const bodyFills = h.drawCalls.filter(call => call.method === 'fill' &&
      call.args[0]?.data === 'M 0 0 L 212 0 L 212 230 Z')
    assert.equal(bodyFills.length, 115)
    assert.ok(bodyFills.every(call => call.fillStyle === color), `${color} should apply on the next rendered frame`)
  }
})

check('painted sail uses the shipped image and loading fallback keeps the animation functional', () => {
  for (const sailLoaded of [true, false]) {
    const h = harness({ sailLoaded }), animation = h.create()
    animation.start(0); h.drawCalls.length = 0; animation.render(5000)
    assert.ok(fs.existsSync(path.resolve(sourceRoot, animation.sail.src)), 'referenced sail artwork must be packaged with the page')
    const imageCalls = h.drawCalls.filter(call => call.method === 'drawImage')
    assert.equal(imageCalls.length, sailLoaded ? 1 : 0)
    if (sailLoaded) assert.equal(imageCalls[0].args[0], animation.sail)
    assert.equal(h.canvas().dataset.phase, 'flying')
    assert.equal(h.drawCalls.filter(call => call.method === 'fill' && call.args[0] === animation.body).length, 115)
  }
})

check('nine-star model preserves nine eight-point sails and the reference eight-whistle ring', () => {
  const model = harness().context.BanyaoKiteAnimation.models.nineStar
  assert.equal(model.outlines.length, 9)
  const ringRadius = Math.SQRT2 / 4
  const expectedCenters = [[0, 0], ...Array.from({ length: 8 }, (_, i) =>
    [Math.cos(i * Math.PI / 4) * ringRadius, Math.sin(i * Math.PI / 4) * ringRadius])]
  const centersSeen = new Set()
  const close = (a, b) => Math.abs(a - b) < 1e-7
  for (const outline of model.outlines) {
    assert.equal(outline.length, 16, 'each painted sail has eight projecting and eight recessed vertices')
    const center = outline.reduce((sum, point) => [sum[0] + point[0] / 16, sum[1] + point[1] / 16], [0, 0])
    const centerIndex = expectedCenters.findIndex(point => close(point[0], center[0]) && close(point[1], center[1]))
    assert.notEqual(centerIndex, -1, 'star center must match the source model')
    assert.ok(!centersSeen.has(centerIndex), 'all nine sails must have distinct centers')
    centersSeen.add(centerIndex)
    const side = centerIndex === 0 ? .2928932188134525 : .20710678118654755
    const radii = outline.map(point => Math.hypot(point[0] - center[0], point[1] - center[1]))
    assert.equal(radii.filter(radius => close(radius, side / Math.SQRT2)).length, 8)
    assert.equal(radii.filter(radius => close(radius, side / (2 * Math.cos(Math.PI / 8)))).length, 8)
  }
  assert.equal(model.whistles.length, 8)
  for (let i = 0; i < model.whistles.length; i++) {
    const whistle = model.whistles[i], angle = Math.PI / 8 + i * Math.PI / 4
    assert.ok(close(whistle.x, Math.cos(angle) * .2135285065))
    assert.ok(close(whistle.y, Math.sin(angle) * .2135285065))
    assert.ok(close(whistle.d, i === 5 || i === 6 ? .09015611460128481 : .05303300858899105))
  }
  assert.equal(model.heroIndex, 6)
})

check('nine-star sail and whistles retain the 1.5 size ratio and all ten selected colors', () => {
  for (const modelSize of [100, 150, 200]) for (const color of ['#9a6737', '#ff3347', '#ff6a00',
    '#ff9800', '#08c77a', '#08b9a9', '#2f86ed', '#8656f6', '#ff2d8b', '#2b2b2b']) {
    const h = harness({ reduced: true, modelSize, color }), animation = h.create()
    animation.start(0, 'nineStar'); h.drawCalls.length = 0; animation.render(1200)
    assert.equal(h.canvas().dataset.kind, 'nineStar')
    const expected = modelSize * 212 / 285 * 1.5
    assert.ok(Math.abs(Number(h.canvas().dataset.extent) - expected) < .001)
    const xs = animation.hitRegion().polygons.flat().map(point => point[0])
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - expected) < .001)
    const bodyFills = h.drawCalls.filter(call => call.method === 'fill' && call.args[0] === animation.body)
    assert.equal(bodyFills.length, 8)
    assert.ok(bodyFills.every(call => call.fillStyle === color))
    assert.ok(fs.existsSync(path.resolve(sourceRoot, animation.sail.src)))
    assert.ok(h.drawCalls.some(call => call.method === 'drawImage' && call.args[0] === animation.sail))
  }
})

check('nine-star reduced motion remains still and completion cleans its canvas and geometry once', () => {
  const h = harness({ reduced: true }); let finishes = 0
  const animation = h.create(() => finishes++)
  animation.start(0, 'nineStar'); animation.render(1200)
  const region = plain(animation.hitRegion())
  animation.render(2400)
  assert.deepEqual(plain(animation.hitRegion()), region)
  assert.equal(animation.notes.length, 0)
  animation.render(4600); animation.finish()
  assert.equal(finishes, 1); assert.equal(animation.hitRegion(), null)
  assert.equal(h.canvas().hidden, true); assert.equal(h.bot.style.opacity, '')
})

check('nine-star native hit geometry leaves the visible gap between adjacent sails transparent', () => {
  const h = harness({ reduced: true }), animation = h.create()
  animation.start(0, 'nineStar'); animation.render(1200)
  const extent = Number(h.canvas().dataset.extent)
  const gap = [h.stage.clientWidth / 2 + .185 * extent, h.stage.clientHeight * .51 - .04 * extent]
  const inside = (point, polygon) => {
    let result = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j]
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result
    }
    return result
  }
  const region = animation.hitRegion()
  assert.ok(inside(gap, region.polygon), 'the selected point demonstrates a gap within the compatibility hull')
  assert.ok(!region.polygons.some(polygon => inside(gap, polygon)), 'the native multi-polygon region must not fill this gap')
})

check('random selection splits the entire range at 0.5 with the chosen kind retained through acknowledgement', () => {
  for (const [random, kind] of [[0, 'hexagonal'], [.499999, 'hexagonal'], [.5, 'nineStar'], [.999999, 'nineStar']]) {
    const h = harness({ withPet: true, random })
    h.doubleClick(); h.setRandom(random < .5 ? .75 : .25); h.acknowledge()
    assert.equal(h.canvas().dataset.kind, kind)
  }
})

check('pending and active double clicks never redraw the lottery; a completed run can pick the other model', () => {
  const h = harness({ withPet: true, random: .25 })
  const before = h.randomCalls
  h.doubleClick(); assert.equal(h.randomCalls, before + 1)
  h.setRandom(.75); h.doubleClick(); h.acknowledge(); h.doubleClick()
  assert.equal(h.randomCalls, before + 1)
  assert.equal(h.canvas().dataset.kind, 'hexagonal')
  h.frame(h.now + 10500); assert.equal(h.active(), false)
  const next = h.randomCalls
  h.doubleClick(); h.acknowledge()
  assert.equal(h.randomCalls, next + 1)
  assert.equal(h.canvas().dataset.kind, 'nineStar')
})

check('nine-star playback recolors immediately and releases native mode on normal completion', () => {
  const h = harness({ withPet: true, random: .75 })
  h.doubleClick(); h.acknowledge(); h.frame(h.now + 5000)
  assert.equal(h.canvas().dataset.kind, 'nineStar')
  h.send({ type: 'set-color', color: '#ff3347' }); h.drawCalls.length = 0; h.frame(h.now + 16)
  const bodyFills = h.drawCalls.filter(call => call.method === 'fill' &&
    call.args[0]?.data === 'M 0 0 L 212 0 L 212 230 Z')
  assert.equal(bodyFills.length, 8); assert.ok(bodyFills.every(call => call.fillStyle === '#ff3347'))
  assert.ok(h.messages.some(message => message.type === 'pet-region' && message.animation === true && message.polygons?.length >= 9))
  h.frame(h.now + 5500)
  assert.equal(h.active(), false); assert.equal(h.modeMessages().at(-1).active, false)
  const restored = h.messages.filter(message => message.type === 'pet-region').at(-1)
  assert.equal(restored.polygon.length, 64)
  assert.equal(Object.hasOwn(restored, 'animation'), false)
  assert.equal(Object.hasOwn(restored, 'polygons'), false)
})

check('nine-star size changes, Escape, context menu and page hide all release the animation viewport', () => {
  for (const cancel of [h => h.send({ type: 'size', size: 300 }),
    h => h.document.dispatch('keydown', { key: 'Escape' }), h => h.pointer(h.stage, 'contextmenu'),
    h => { h.document.hidden = true; h.document.dispatch('visibilitychange') }]) {
    const h = harness({ withPet: true, random: .75 })
    h.doubleClick(); h.acknowledge(); assert.equal(h.canvas().dataset.kind, 'nineStar'); cancel(h)
    assert.equal(h.active(), false); assert.equal(h.canvas().hidden, true)
    assert.equal(h.modeMessages().at(-1).active, false)
  }
})

check('frame skips use elapsed time and completion disposes transient state exactly once', () => {
  const h = harness(); let finishes = 0
  const animation = h.create(() => finishes++)
  animation.start(100)
  animation.render(8800); assert.equal(h.canvas().dataset.phase, 'returning')
  animation.render(12000)
  assert.equal(animation.active, false); assert.equal(animation.hitRegion(), null)
  assert.equal(animation.notes.length, 0); assert.equal(h.canvas().hidden, true)
  assert.equal(h.bot.style.opacity, ''); assert.equal(h.active(), false)
  animation.finish(); animation.render(15000); assert.equal(finishes, 1)
  assert.equal(animation.start(16000), true)
  assert.equal(h.stage.children.length, 1, 'replay reuses the Canvas')
})

check('reduced motion settles without wind movement or continuously emitted notes', () => {
  const h = harness({ reduced: true }), animation = h.create()
  animation.start(0); animation.render(1200)
  const first = plain(animation.hitRegion())
  animation.render(2400)
  assert.deepEqual(plain(animation.hitRegion()), first)
  animation.render(3900); assert.equal(animation.notes.length, 0)
  animation.render(4600); assert.equal(animation.active, false)
})

check('musical note population stays bounded and old notes are reclaimed', () => {
  const h = harness(), animation = h.create()
  animation.start(0)
  for (let time = 0; time < 10400; time += 16) {
    animation.render(time)
    assert.ok(animation.notes.length <= 7)
    for (const note of animation.notes) assert.ok(time / 1000 - note.born < note.life)
  }
  animation.render(10400); assert.equal(animation.notes.length, 0)
})

check('single click waits for the host double-click interval before bouncing', () => {
  const h = harness({ withPet: true })
  h.send({ type: 'interaction-settings', doubleClickMs: 700 })
  h.click(); const released = h.now
  h.advance(released + 729); assert.equal(h.bot.classList.contains('anim-bounce'), false)
  h.advance(released + 730); assert.equal(h.bot.classList.contains('anim-bounce'), true)
  assert.equal(h.modeMessages().length, 0)
})

check('double click waits for native resize acknowledgement and two paint frames', () => {
  const h = harness({ withPet: true })
  h.doubleClick()
  assert.deepEqual(h.modeMessages(), [{ type: 'kite-mode', active: true }])
  assert.equal(h.active(), false); assert.equal(h.canvas(), undefined)
  h.send({ type: 'kite-mode', active: true }); h.frame(h.now + 16)
  assert.equal(h.active(), false)
  h.frame(h.now + 16); assert.equal(h.active(), true)
  h.advance(h.now + 700); assert.equal(h.bot.classList.contains('anim-bounce'), false)
})

check('repeated double clicks cannot create overlapping animations or resize requests', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.doubleClick()
  assert.equal(h.modeMessages().filter(m => m.active).length, 1)
  h.acknowledge(); const canvas = h.canvas()
  h.doubleClick(); h.frame(h.now + 16)
  assert.equal(h.canvas(), canvas); assert.equal(h.stage.children.filter(c => c.tagName === 'canvas').length, 1)
  assert.equal(h.modeMessages().filter(m => m.active).length, 1)
})

check('drag movement cannot become a double click or delayed single click', () => {
  const h = harness({ withPet: true })
  h.pointer(h.stage, 'pointerdown')
  h.pointer(h.document, 'pointermove', { clientX: 194, movementX: 14, movementY: 0 })
  h.pointer(h.document, 'pointerup', { target: h.stage })
  h.pointer(h.stage, 'dblclick', { target: h.stage })
  h.advance(800)
  assert.ok(h.messages.some(m => m.type === 'drag' && m.dx === 14))
  assert.equal(h.modeMessages().length, 0); assert.equal(h.bot.classList.contains('anim-bounce'), false)
})

check('one click following a drag is not accepted as two valid model clicks', () => {
  const h = harness({ withPet: true })
  h.pointer(h.stage, 'pointerdown')
  h.pointer(h.document, 'pointermove', { clientX: 194, movementX: 14 })
  h.pointer(h.document, 'pointerup', { target: h.stage })
  h.click(); h.pointer(h.stage, 'dblclick', { target: h.stage })
  assert.equal(h.modeMessages().length, 0)
})

check('blank stage double click cannot activate the model animation', () => {
  const h = harness({ withPet: true })
  h.doubleClick(h.stage)
  assert.equal(h.modeMessages().length, 0)
})

check('host handshake timeout restores normal state and rejects a late acknowledgement', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.advance(h.now + 1501)
  assert.deepEqual(h.modeMessages().map(m => m.active), [true, false])
  h.acknowledge()
  assert.equal(h.active(), false); assert.equal(h.canvas(), undefined)
  assert.equal(h.modeMessages().at(-1).active, false)
  assert.equal(h.bot.classList.contains('anim-breathe'), true)
})

check('cancellation during queued native acknowledgement cannot resurrect the animation', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.send({ type: 'kite-mode', active: true }); h.frame(h.now + 16)
  h.document.dispatch('keydown', { key: 'Escape' }); h.frame(h.now + 16)
  assert.equal(h.active(), false); assert.equal(h.canvas(), undefined)
  assert.equal(h.modeMessages().at(-1).active, false)
})

check('a cancelled handshake callback cannot start a later request before its own acknowledgement', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.send({ type: 'kite-mode', active: true }); h.frame(h.now + 16)
  h.document.dispatch('keydown', { key: 'Escape' })
  h.doubleClick(); h.frame(h.now + 16)
  assert.equal(h.active(), false, 'the old second paint frame belongs to the cancelled request')
  h.acknowledge(); assert.equal(h.active(), true)
})

check('typing and focus updates do not replace pending animation; latest focus resumes on cancel', () => {
  const h = harness({ withPet: true })
  h.doubleClick()
  h.send({ type: 'typing', key: 65 }); h.send({ type: 'focus-state', status: 'running', mode: 'focus' })
  assert.equal(h.stage.querySelectorAll('.pet-note').length, 0)
  assert.equal(h.bot.classList.contains('anim-typing'), false)
  h.acknowledge()
  assert.equal(h.active(), true)
  h.send({ type: 'focus-state', status: 'running', mode: 'short-break' })
  h.send({ type: 'typing', key: 66 }); h.send({ type: 'interact' }); h.send({ type: 'systemIdle', seconds: 900 })
  assert.equal(h.active(), true); assert.equal(h.stage.querySelectorAll('.pet-note').length, 0)
  h.document.dispatch('keydown', { key: 'Escape' })
  assert.equal(h.active(), false); assert.equal(h.bot.classList.contains('anim-sleep'), true)
  assert.equal(h.tooltip.textContent, '休息')
})

check('completed animation releases native mode and restores the original SVG hit region', () => {
  const h = harness({ withPet: true })
  h.doubleClick(); h.acknowledge(); h.frame(h.now + 5000)
  assert.equal(h.active(), true)
  h.frame(h.now + 5500)
  assert.equal(h.active(), false); assert.equal(h.modeMessages().at(-1).active, false)
  const region = h.messages.filter(m => m.type === 'pet-region').at(-1)
  assert.equal(region.polygon.length, 64); assert.equal(h.bot.style.opacity, '')
})

check('size change, context menu and hidden page each cancel and release native mode', () => {
  for (const cancel of [h => h.send({ type: 'size', size: 300 }),
    h => h.pointer(h.stage, 'contextmenu'),
    h => { h.document.hidden = true; h.document.dispatch('visibilitychange') }]) {
    const h = harness({ withPet: true })
    h.doubleClick(); h.acknowledge(); cancel(h)
    assert.equal(h.active(), false); assert.equal(h.canvas().hidden, true)
    assert.equal(h.modeMessages().at(-1).active, false)
  }
})

check('missing Canvas context fails safely without keeping an enlarged native window', () => {
  const h = harness({ withPet: true, canvasAvailable: false })
  h.doubleClick(); h.acknowledge()
  assert.equal(h.active(), false); assert.equal(h.modeMessages().at(-1).active, false)
  assert.equal(h.bot.classList.contains('anim-breathe'), true)
})

console.log(`Kite animation acceptance: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
