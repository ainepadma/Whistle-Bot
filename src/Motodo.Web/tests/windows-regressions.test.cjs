const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const dayjs = require('dayjs')

const sourceRoot = path.resolve(__dirname, '../src')
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

// Execute the production modules with controlled host messages and time. No browser or user data is used.
function loader(mocks = {}, globals = {}) {
    const cache = new Map()
    function load(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        let filename
        if (name.startsWith('@/')) filename = path.join(sourceRoot, 'renderer', name.slice(2))
        else if (name.startsWith('@shared/')) filename = path.join(sourceRoot, 'shared', name.slice(8))
        else return require(name)
        filename = ['.ts', '.tsx'].map(ext => filename + ext).find(fs.existsSync)
        if (!filename) throw new Error(`Missing source: ${name}`)
        if (cache.has(filename)) return cache.get(filename).exports
        const module = { exports: {} }
        cache.set(filename, module)
        const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
        }).outputText
        vm.runInNewContext(code, { module, exports: module.exports, require: load, console, ...globals }, { filename })
        return module.exports
    }
    return load
}

// Minimal hook scheduling keeps effects and state across renders, including stale async responses.
function hooks() {
    let stateIndex = 0, effectIndex = 0, refIndex = 0
    const states = [], refs = [], effects = [], scheduled = []
    const react = {
        useState(initial) {
            const i = stateIndex++
            if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
            return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
        },
        useEffect(callback, dependencies) {
            const i = effectIndex++
            const previous = effects[i]
            if (!previous || !dependencies || dependencies.some((value, j) => value !== previous.dependencies[j])) {
                scheduled.push(() => { previous?.cleanup?.(); effects[i] = { dependencies, cleanup: callback() } })
            }
        },
        useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } },
        useMemo(callback) { return callback() },
        useCallback(callback) { return callback }
    }
    react.useLayoutEffect = react.useEffect
    return {
        react, states, refs,
        render(component, props) { stateIndex = effectIndex = refIndex = 0; return component(props) },
        effects() { for (const callback of scheduled.splice(0)) callback() },
        cleanup() { for (const effect of effects) effect?.cleanup?.() }
    }
}

function elements(node, predicate) {
    if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate))
    if (!node || typeof node !== 'object') return []
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)]
}
function label(node) {
    if (Array.isArray(node)) return node.map(label).join('')
    if (node && typeof node === 'object') return label(node.props?.children)
    return node == null ? '' : String(node)
}

function cardContentHarness({ naturalHeight = 240, surfaceHeight = 200, viewportHeight = 170 } = {}) {
    const h = hooks(), frames = new Map(), listeners = new Map(), observed = new Set(), requested = [], scrolls = []
    let nextFrame = 1, observer, disconnected = false
    const surface = { height: surfaceHeight, getBoundingClientRect() { return { height: this.height } } }
    const body = { height: naturalHeight, getBoundingClientRect() { return { height: this.height } } }
    const view = {
        clientHeight: viewportHeight, scrollHeight: naturalHeight, scrollTop: 0,
        getBoundingClientRect() { return { height: this.clientHeight } },
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
        scrollBy(options) {
            scrolls.push({ top: options.top, behavior: options.behavior })
            this.scrollTop = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, this.scrollTop + options.top))
            listeners.get('scroll')?.()
        }
    }
    const load = loader({ react: h.react }, {
        window: { electronAPI: { card: { fitContent: (kind, height) => { requested.push({ kind, height }); return Promise.resolve() } } } },
        requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id },
        cancelAnimationFrame: id => frames.delete(id),
        ResizeObserver: class {
            constructor(callback) { observer = callback }
            observe(target) { observed.add(target) }
            disconnect() { disconnected = true; observed.clear() }
        }
    })
    const Component = load('@/components/CardContent').default
    const render = () => h.render(Component, { kind: 'next', children: 'Visible card contents' })
    const initial = render()
    for (const [className, target] of [['card-content-frame', surface], ['card-content-viewport', view], ['card-natural-content', body]]) {
        elements(initial, node => node.props?.className === className)[0].ref.current = target
    }
    h.effects()
    return {
        surface, body, view, requested, scrolls, frames, observed, listeners,
        resize() { if (!disconnected) observer() },
        paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); const tree = render(); h.effects(); return tree },
        cleanup: () => h.cleanup(),
        disconnected: () => disconnected
    }
}

test('settings synchronize between existing windows without echo writes or overwriting native auto-start', () => {
    const storage = new Map()
    let writes = 0
    function createWindow() {
        const listeners = new Map()
        let dark = false
        const load = loader({}, {
            localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes++; storage.set(key, value) } },
            document: { documentElement: { classList: { toggle: (_key, value) => { dark = value } } } },
            window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener: (name, callback) => listeners.set(name, callback) }
        })
        return { store: load('@/stores/settings.store').useSettingsStore, receive: listeners.get('storage'), dark: () => dark }
    }
    const calendar = createWindow(), manage = createWindow()
    calendar.store.setState({ autoStart: true })
    manage.store.getState().setTheme('dark')
    manage.store.getState().setTimeFormat('12h')
    manage.store.getState().setWorkweek(true)
    manage.store.getState().setDayStart('06:00')
    const before = writes
    calendar.receive({ key: 'banyao.schedule.settings.v1' })
    assert.equal(calendar.store.getState().theme, 'dark')
    assert.equal(calendar.store.getState().timeFormat, '12h')
    assert.equal(calendar.store.getState().workweek, true)
    assert.equal(calendar.store.getState().dayEnd, '05:59')
    assert.equal(calendar.store.getState().autoStart, true)
    assert.equal(calendar.dark(), true)
    assert.equal(writes, before)
})

test('Today reloads on changes and midnight, rejects stale responses and cleans up subscriptions', async () => {
    const h = hooks(), subscribers = new Map(), timers = new Map(), requests = []
    let now = '2026-09-07T23:59:00+08:00'
    const fakeDayjs = (...args) => args.length ? dayjs(...args) : dayjs(now)
    const load = loader({
        react: h.react, dayjs: fakeDayjs,
        '@/stores/settings.store': { useSettingsStore: select => select({ timeFormat: '24h' }) },
        '@/stores/schedule-popup.store': { useSchedulePopupStore: select => select({ openDetail() {} }) },
        '@/components/ui/Icons': () => null
    }, { window: {
        electronAPI: {
            event: { query: range => { const request = deferred(); requests.push({ ...request, range }); return request.promise } },
            semester: { getActive: async () => null },
            on: (name, callback) => { subscribers.set(name, callback); return () => subscribers.delete(name) }
        },
        setInterval: callback => { timers.set(1, callback); return 1 }, clearInterval: id => timers.delete(id)
    } })
    const Today = load('@/components/TodayCard').default
    h.render(Today, {}); h.effects()
    subscribers.get('schedule:changed')()
    requests[1].resolve([{ title: 'new' }]); await flush()
    requests[0].resolve([{ title: 'stale' }]); await flush()
    assert.equal(h.states[1][0].title, 'new')
    now = '2026-09-08T00:01:00+08:00'
    timers.get(1)()
    assert.equal(requests.length, 3)
    assert.equal(requests[2].range.start, '2026-09-07T16:00:00.000Z')
    assert.equal(requests[2].range.end, '2026-09-08T16:00:00.000Z')
    h.cleanup()
    requests[2].resolve([{ title: 'after unmount' }]); await flush()
    assert.equal(h.states[1][0].title, 'new')
    assert.equal(subscribers.size, 0)
    assert.equal(timers.size, 0)
})

test('calendar store keeps the latest range when older queries finish late, then refreshes on host change', async () => {
    const requests = [], subscribers = new Map()
    const load = loader({}, { window: { electronAPI: {
        event: { query: range => { const request = deferred(); requests.push({ ...request, range }); return request.promise } },
        on: (name, callback) => subscribers.set(name, callback)
    } } })
    const store = load('@/stores/event.store').useEventStore
    const first = store.getState().loadEvents({ start: 'first', end: 'first-end' })
    const second = store.getState().loadEvents({ start: 'second', end: 'second-end' })
    requests[1].resolve([{ id: 'new' }]); await second
    requests[0].resolve([{ id: 'old' }]); await first
    assert.equal(store.getState().events[0].id, 'new')
    subscribers.get('schedule:changed')()
    assert.equal(requests[2].range.start, 'second')
    requests[2].resolve([{ id: 'external-change' }]); await flush()
    assert.equal(store.getState().events[0].id, 'external-change')
})

test('editing an occurrence loads the original series date and missing roots fail explicitly', async () => {
    const requested = []
    let root = { id: 'series', start_at: '2026-01-01T09:00:00Z' }
    const load = loader({}, { window: { electronAPI: { event: { getById: async id => { requested.push(id); return root } } } } })
    const recurrence = load('@/utils/recurrence')
    const occurrence = { id: 'series@instance', recurrence_parent_id: 'series', start_at: '2026-09-07T09:00:00Z' }
    assert.equal((await recurrence.loadSeriesEvent(occurrence)).start_at, root.start_at)
    assert.equal(requested[0], 'series')
    assert.equal(recurrence.seriesId(occurrence), 'series')
    root = null
    await assert.rejects(recurrence.loadSeriesEvent(occurrence), /已被删除/)
})

test('title-only edits preserve complex recurrence, precise original dates and multiple reminders', async () => {
    for (const rule of ['FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10', 'FREQ=YEARLY;BYMONTH=9']) {
        const event = { id: 'series', calendar_id: 'default', title: 'original', start_at: '2026-09-07T09:00:30+08:00', end_at: '2026-09-07T10:00:30+08:00', is_all_day: false, item_type: 'plan', rrule_str: rule, reminders: [{ minutes: 0 }, { minutes: 15 }] }
        let saved
        const props = { event, onSave: async input => { saved = input }, onCancel() {} }
        // Each form is mounted independently, as the UI keys the editor by event ID.
        const formHooks = hooks()
        const formLoad = loader({ react: formHooks.react,
            '@/stores/semester.store': { useSemesterStore: select => select({ semesters: [], activeSemester: null, loadSemesters() {} }) },
            '@/stores/course.store': { useCourseStore: () => () => {} },
            '@/stores/course-calendar.store': { useCourseCalendarStore: { getState: () => ({ refresh() {} }) } },
            '@/components/ScheduleTimeFields': () => null
        })
        const Form = formLoad('@/pages/EventEdit').default
        let tree = formHooks.render(Form, props)
        elements(tree, node => node.type === 'input' && node.props.placeholder === '日程标题')[0].props.onChange({ target: { value: 'renamed' } })
        tree = formHooks.render(Form, props)
        await tree.props.onSubmit({ preventDefault() {} })
        assert.equal(saved.title, 'renamed')
        assert.equal(saved.rrule_str, rule)
        assert.equal(saved.start_at, event.start_at)
        assert.equal(saved.end_at, event.end_at)
        assert.deepEqual(saved.reminders, event.reminders)
    }
})

test('action card leaves native sizing to its shared content host and keeps empty sections collapsed', async () => {
    const h = hooks(), requested = []
    const load = loader({
        react: h.react,
        '@/components/FocusCard': () => null,
        '@/stores/event-ui.store': { useEventUiStore: select => select({ openCreate() {}, openDetail() {} }) }
    }, {
        window: { electronAPI: {
            event: { query: async () => [] }, on: () => () => {},
            card: { resize: (kind, width, height) => requested.push({ kind, width, height }) }
        }, setInterval() {}, clearInterval() {} }
    })
    const Card = load('@/components/NextCard').default
    h.render(Card, {})
    h.effects()
    await flush()
    let tree = h.render(Card, {})
    assert.equal(elements(tree, node => node.props?.cardKind === 'next')[0].props.autoResize, false)
    assert.equal(requested.length, 0)

    const sectionToggles = elements(tree, node => node.type === 'button' && node.props?.['aria-controls']?.startsWith('action-'))
    assert.deepEqual(sectionToggles.map(node => node.props['aria-expanded']), [false, false])
    assert.equal(elements(tree, node => node.props?.id === 'action-pending-items').length, 0)
    assert.equal(elements(tree, node => node.props?.id === 'action-upcoming-items').length, 0)

    sectionToggles[0].props.onClick()
    tree = h.render(Card, {})
    assert.equal(elements(tree, node => node.props?.id === 'action-pending-items').length, 1)
    assert.equal(elements(tree, node => node.props?.id === 'action-upcoming-items').length, 0)
    h.cleanup()
})

test('action card reveals newly loaded pending and upcoming items while respecting explicit collapse across refreshes', async () => {
    const h = hooks(), subscribers = new Map(), timers = new Map()
    let todos = [], planned = []
    const load = loader({
        react: h.react, '@/components/FocusCard': () => null,
        '@/stores/event-ui.store': { useEventUiStore: select => select({ openCreate() {}, openDetail() {} }) }
    }, { window: {
        electronAPI: {
            event: { query: async range => range.item_type === 'todo' ? todos : planned },
            on: (name, callback) => { subscribers.set(name, callback); return () => subscribers.delete(name) }
        },
        setInterval: callback => { timers.set(1, callback); return 1 }, clearInterval: id => timers.delete(id)
    } })
    const Card = load('@/components/NextCard').default
    const toggles = tree => elements(tree, node => node.type === 'button' && node.props?.['aria-controls']?.startsWith('action-'))
    const refresh = async () => { subscribers.get('schedule:changed')(); await flush(); return h.render(Card, {}) }
    h.render(Card, {}); h.effects(); await flush()
    let tree = h.render(Card, {})
    assert.deepEqual(toggles(tree).map(node => node.props['aria-expanded']), [false, false])
    todos = [{ id: 'todo-1', title: '准备课程笔记', item_type: 'todo', start_at: '2026-09-11T09:00:00Z', is_completed: false }]
    tree = await refresh()
    assert.deepEqual(toggles(tree).map(node => node.props['aria-expanded']), [true, false])
    assert.ok(label(tree).includes('准备课程笔记'))
    planned = [{ id: 'plan-1', title: '小组讨论', item_type: 'plan', start_at: '2026-09-11T10:00:00Z', is_completed: false }]
    tree = await refresh()
    assert.deepEqual(toggles(tree).map(node => node.props['aria-expanded']), [true, true])
    assert.ok(label(tree).includes('小组讨论'))
    toggles(tree)[0].props.onClick(); tree = h.render(Card, {})
    todos = [{ ...todos[0], title: '新的待办事项' }]
    tree = await refresh()
    assert.deepEqual(toggles(tree).map(node => node.props['aria-expanded']), [false, true])
    assert.ok(!label(tree).includes('新的待办事项'))
    toggles(tree)[1].props.onClick(); tree = h.render(Card, {})
    todos = []; planned = []; tree = await refresh()
    todos = [{ id: 'todo-2', title: '稍后整理', item_type: 'todo', start_at: '2026-09-11T11:00:00Z' }]
    planned = [{ id: 'plan-2', title: '稍后会议', item_type: 'plan', start_at: '2026-09-11T12:00:00Z' }]
    tree = await refresh()
    assert.deepEqual(toggles(tree).map(node => node.props['aria-expanded']), [false, false])
    h.cleanup()
    assert.equal(subscribers.size, 0); assert.equal(timers.size, 0)
})

test('card pager disappears when content fits the full frame even while the pager still reduces its viewport', () => {
    const h = cardContentHarness()
    let tree = h.paint()
    assert.equal(elements(tree, node => node.type === 'nav').length, 1)
    assert.deepEqual(h.requested, [{ kind: 'next', height: 282 }])
    // The old pager leaves only 170px visible, but releasing it makes the full 200px frame available.
    h.body.height = h.view.scrollHeight = 190
    h.resize(); tree = h.paint()
    assert.equal(elements(tree, node => node.type === 'nav').length, 0)
    assert.deepEqual(h.requested, [{ kind: 'next', height: 282 }, { kind: 'next', height: 232 }])
    h.view.clientHeight = 200
    h.resize(); tree = h.paint()
    assert.equal(elements(tree, node => node.type === 'nav').length, 0)
    assert.equal(h.requested.length, 2, 'releasing pager space must not repeat the same native content request')
    h.cleanup()
})

test('manual card resizing updates page navigation without echoing unchanged natural height to the native host', () => {
    const h = cardContentHarness({ naturalHeight: 500, surfaceHeight: 300, viewportHeight: 270 })
    const buttons = tree => elements(tree, node => node.type === 'button')
    let tree = h.paint()
    assert.deepEqual(buttons(tree).map(node => node.props.disabled), [true, false])
    buttons(tree)[1].props.onClick(); tree = h.paint()
    assert.deepEqual(h.scrolls.at(-1), { top: 246, behavior: 'auto' })
    assert.deepEqual(buttons(tree).map(node => node.props.disabled), [false, true])
    buttons(tree)[0].props.onClick(); tree = h.paint()
    assert.equal(h.view.scrollTop, 0)
    assert.deepEqual(buttons(tree).map(node => node.props.disabled), [true, false])
    h.surface.height = 240; h.view.clientHeight = 210
    h.resize(); tree = h.paint()
    buttons(tree)[1].props.onClick(); tree = h.paint()
    assert.equal(h.scrolls.at(-1).top, 186, 'page steps follow the resized viewport')
    assert.deepEqual(buttons(tree).map(node => node.props.disabled), [false, false])
    h.surface.height = h.view.clientHeight = 600; h.view.scrollTop = 0
    h.resize(); tree = h.paint()
    assert.equal(elements(tree, node => node.type === 'nav').length, 0)
    assert.deepEqual(h.requested, [{ kind: 'next', height: 542 }])
    h.cleanup()
})

test('card measurement coalesces resize events and cancels pending work and subscriptions on unmount', () => {
    const h = cardContentHarness()
    assert.equal(h.observed.size, 3)
    h.resize(); h.resize(); h.resize()
    assert.equal(h.frames.size, 1)
    h.paint(); assert.equal(h.requested.length, 1)
    h.body.height = 300; h.resize()
    const abandoned = [...h.frames.values()]
    h.cleanup()
    assert.equal(h.frames.size, 0)
    assert.equal(h.observed.size, 0)
    assert.equal(h.listeners.size, 0)
    assert.equal(h.disconnected(), true)
    abandoned.forEach(callback => callback())
    assert.equal(h.requested.length, 1, 'an already dispatched callback must not fit an unmounted card')
})

test('completing or deleting a repeating todo requires an explicit second action', async () => {
    const h = hooks()
    const load = loader({ react: h.react, '@/stores/settings.store': { useSettingsStore: select => select({ timeFormat: '24h' }) } })
    const Detail = load('@/pages/EventDetail').default
    let completed = 0, deleted = 0
    const props = { event: { id: 'series@instance', recurrence_parent_id: 'series', title: 'repeating', start_at: '2026-09-07T09:00:00Z', end_at: '2026-09-07T10:00:00Z', item_type: 'todo', is_completed: false, rrule_str: 'FREQ=DAILY' }, onClose() {}, onEdit() {}, onToggleComplete: async () => { completed++ }, onDelete: async () => { deleted++ } }
    let tree = h.render(Detail, props)
    const button = (text) => elements(tree, node => node.type === 'button' && label(node) === text)[0]
    await button('完成整个重复待办').props.onClick(); await flush()
    assert.equal(completed, 0)
    tree = h.render(Detail, props)
    await button('确认完成整个重复待办').props.onClick(); await flush()
    assert.equal(completed, 1)
    tree = h.render(Detail, props)
    await button('删除整系列').props.onClick(); await flush()
    assert.equal(deleted, 0)
    tree = h.render(Detail, props)
    await button('确认删除整系列').props.onClick(); await flush()
    assert.equal(deleted, 1)
})
