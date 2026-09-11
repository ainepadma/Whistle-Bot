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

test('action card keeps its native size as content refreshes and disables nested focus resizing', async () => {
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
    const tree = h.render(Card, {})
    assert.equal(elements(tree, node => node.props?.cardKind === 'next')[0].props.autoResize, false)
    assert.equal(requested.length, 0)
    h.cleanup()
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
