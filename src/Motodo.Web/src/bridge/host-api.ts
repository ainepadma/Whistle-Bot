export {}
type HostMessage =
    | { type: 'motodo:response'; id: number; ok: boolean; result?: unknown; error?: string }
    | { type: 'motodo:event'; channel: string; payload?: unknown }

type Callback = (...args: unknown[]) => void

declare global {
    interface Window {
        electronAPI: any
        chrome?: {
            webview?: {
                postMessage: (message: unknown) => void
                addEventListener: (name: 'message', callback: (event: { data: HostMessage }) => void) => void
            }
        }
    }
}

let nextRequestId = 1
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>()
const subscriptions = new Map<string, Set<Callback>>()

function invoke(method: string, ...args: unknown[]): Promise<any> {
    const webview = window.chrome?.webview
    if (!webview) return Promise.reject(new Error('日程模块只能在小鹞 WhistleBot 中运行'))

    const id = nextRequestId++
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        webview.postMessage({ type: 'motodo:request', id, method, args })
    })
}

function subscribe(channel: string, callback: Callback): () => void {
    let handlers = subscriptions.get(channel)
    if (!handlers) {
        handlers = new Set()
        subscriptions.set(channel, handlers)
    }
    handlers.add(callback)
    return () => handlers?.delete(callback)
}

window.chrome?.webview?.addEventListener('message', ({ data }) => {
    if (data.type === 'motodo:response') {
        const request = pending.get(data.id)
        if (!request) return
        pending.delete(data.id)
        if (data.ok) request.resolve(data.result)
        else request.reject(new Error(data.error || '宿主操作失败'))
        return
    }
    if (data.type === 'motodo:event') subscriptions.get(data.channel)?.forEach((callback) => callback(data.payload))
})

// WebView2 bridge used by both the full console and detachable desktop cards.
window.electronAPI = {
    calendar: {
        list: () => invoke('calendar:list'), create: (data: unknown) => invoke('calendar:create', data),
        update: (id: string, data: unknown) => invoke('calendar:update', id, data), remove: (id: string) => invoke('calendar:remove', id),
        toggleVisible: (id: string) => invoke('calendar:toggle-visible', id)
    },
    event: {
        query: (query: unknown) => invoke('event:query', query), getById: (id: string) => invoke('event:get-by-id', id),
        create: (data: unknown) => invoke('event:create', data), update: (id: string, data: unknown) => invoke('event:update', id, data),
        remove: (id: string) => invoke('event:remove', id), search: (keyword: string) => invoke('event:search', keyword)
    },
    semester: {
        list: () => invoke('semester:list'), getActive: () => invoke('semester:get-active'), create: (data: unknown) => invoke('semester:create', data),
        update: (id: string, data: unknown) => invoke('semester:update', id, data), remove: (id: string) => invoke('semester:remove', id)
    },
    course: {
        listBySemester: (id: string) => invoke('course:list-by-semester', id), create: (data: unknown) => invoke('course:create', data),
        update: (id: string, data: unknown) => invoke('course:update', id, data), remove: (id: string) => invoke('course:remove', id)
    },
    specialDate: {
        list: () => invoke('special-date:list'), create: (data: unknown) => invoke('special-date:create', data), remove: (id: string) => invoke('special-date:remove', id)
    },
    reminder: {
        getPending: () => invoke('reminder:pending'), dismiss: (id: string) => invoke('reminder:dismiss', id), snooze: (id: string, minutes: number) => invoke('reminder:snooze', id, minutes)
    },
    export: {
        ics: (ids: string[]) => invoke('export:ics', ids), json: (ids: string[]) => invoke('export:json', ids),
        importIcs: (path: string) => invoke('export:import-ics', path), importJson: (path: string) => invoke('export:import-json', path),
        selectFile: () => invoke('export:select-file'), saveFile: (payload: unknown) => invoke('export:save-file', payload)
    },
    system: {
        getAppVersion: () => invoke('system:app-version'), getPlatform: () => invoke('system:platform'),
        setAutoStart: (enabled: boolean) => invoke('system:set-auto-start', enabled), isAutoStartEnabled: () => invoke('system:is-auto-start',),
        getPetColor: () => invoke('system:pet-color'),
        openExternal: (url: string) => invoke('system:open-external', url)
    },
    window: {
        minimize: () => invoke('window:minimize'), toggleMaximize: () => invoke('window:toggle-maximize'), close: () => invoke('window:close'),
        isMaximized: () => invoke('window:is-maximized'), toggleCard: () => invoke('window:toggle-card'), closeCard: () => invoke('window:close-card'),
        isCardVisible: () => invoke('window:card-visible'), openEdit: (event: unknown) => invoke('window:open-edit', event),
        openConsole: () => invoke('window:open-console')
    },
    card: {
        getState: (kind: string) => invoke('card:get-state', kind),
        show: (kind: string) => invoke('card:show', kind),
        switch: (from: string, to: string) => invoke('card:switch', from, to),
        toggle: (kind: string) => invoke('card:toggle', kind),
        beginDrag: (kind: string) => invoke('card:begin-drag', kind),
        togglePinned: (kind: string) => invoke('card:toggle-pinned', kind),
        drag: (kind: string, dx: number, dy: number) => invoke('card:drag', kind, dx, dy),
        resize: (kind: string, width: number, height: number) => invoke('card:resize', kind, width, height),
        close: (kind: string) => invoke('card:close', kind)
    },
    focus: {
        getState: () => invoke('focus:state'), toggle: () => invoke('focus:toggle'), reset: () => invoke('focus:reset'),
        skip: () => invoke('focus:skip'), setPreset: (id: string) => invoke('focus:set-preset', id),
setCustom: (input: unknown) => invoke('focus:set-custom', input), startForEvent: (eventId: string) => invoke('focus:start-for-event', eventId),
        detachEvent: () => invoke('focus:detach-event'), sessions: (eventId: string) => invoke('focus:sessions', eventId),
        completeEvent: () => invoke('focus:complete-event'), openEvent: () => invoke('focus:open-event')
    },
    updater: { check: () => invoke('update:check'), download: () => invoke('update:download'), install: () => invoke('update:install') },
    on: subscribe
}

function blend(hex: string, target: number, amount: number): string {
    const value = Number.parseInt(hex.slice(1), 16)
    const channels = [value >> 16, (value >> 8) & 255, value & 255]
    return `#${channels.map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`
}

function applyPetColor(value: unknown): void {
    const color = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2f86ed'
    const root = document.documentElement.style
    root.setProperty('--pet-primary-50', blend(color, 255, 0.94))
    root.setProperty('--pet-primary-100', blend(color, 255, 0.86))
    root.setProperty('--pet-primary-300', blend(color, 255, 0.54))
    root.setProperty('--pet-primary-500', color)
    root.setProperty('--pet-primary-600', blend(color, 0, 0.14))
    root.setProperty('--pet-primary-700', blend(color, 0, 0.27))
    root.setProperty('--pet-primary-900', blend(color, 0, 0.52))
    root.setProperty('--pet-primary-950', blend(color, 0, 0.68))
}

void window.electronAPI.system.getPetColor().then(applyPetColor).catch(() => applyPetColor('#2f86ed'))
window.electronAPI.on('pet:color', (color: unknown) => applyPetColor(color))