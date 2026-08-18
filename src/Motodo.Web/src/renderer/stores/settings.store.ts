import { create } from 'zustand'
import { subtractMinutesFromTime } from '@shared/utils/date'

export type Theme = 'light' | 'dark' | 'system'
export type TimeFormat = '12h' | '24h'
export type DefaultView = 'month' | 'week' | 'day'

const STORAGE_KEY = 'banyao.schedule.settings.v1'
const LEGACY_STORAGE_KEY = 'motodo.settings.v2'

interface PersistedSettings {
    theme: Theme
    weekStartsOn: 0 | 1
    timeFormat: TimeFormat
    defaultView: DefaultView
    dayStart: string // 每日显示起始 HH:mm
    dayEnd: string // 每日显示结束 HH:mm（可跨午夜）
    dayBottomSpace: number // 时间轴底部留白（分钟）
    showWeekNumbers: boolean // 月视图显示周数
    showExtraDays: boolean // 月视图显示非本月日期
    workweek: boolean // 周视图仅显示工作日
    scrollToNow: boolean // 打开周/日视图自动定位当前时间
}

const DEFAULT_SETTINGS: PersistedSettings = {
    theme: 'system',
    weekStartsOn: 1,
    timeFormat: '24h',
    defaultView: 'week',
    dayStart: '04:00',
    dayEnd: '03:59',
    dayBottomSpace: 60,
    showWeekNumbers: false,
    showExtraDays: true,
    workweek: false,
    scrollToNow: true
}

function loadSettings(): PersistedSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...DEFAULT_SETTINGS }
        const parsed = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
        // 统一为单一「每日起始时间」：结束时间自动取起始前一分钟（跨午夜）
        parsed.dayEnd = subtractMinutesFromTime(parsed.dayStart, 1)
        return parsed
    } catch {
        return { ...DEFAULT_SETTINGS }
    }
}

function saveSettings(s: PersistedSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
        // 存储不可用时忽略
    }
}

function applyTheme(theme: Theme): void {
    const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
}

const initial = loadSettings()

interface SettingsStore extends PersistedSettings {
    autoStart: boolean
    setTheme: (theme: Theme) => void
    setWeekStartsOn: (day: 0 | 1) => void
    setTimeFormat: (format: TimeFormat) => void
    setDefaultView: (view: DefaultView) => void
    setDayStart: (value: string) => void
    setDayBottomSpace: (value: number) => void
    setShowWeekNumbers: (value: boolean) => void
    setShowExtraDays: (value: boolean) => void
    setWorkweek: (value: boolean) => void
    setScrollToNow: (value: boolean) => void
    setAutoStart: (enabled: boolean) => void
    initAutoStart: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
    ...initial,
    autoStart: false,

    setTheme: (theme) => {
        set({ theme })
        saveSettings(get())
        applyTheme(theme)
    },

    setWeekStartsOn: (day) => {
        set({ weekStartsOn: day })
        saveSettings(get())
    },

    setTimeFormat: (format) => {
        set({ timeFormat: format })
        saveSettings(get())
    },

    setDefaultView: (view) => {
        set({ defaultView: view })
        saveSettings(get())
    },

    setDayStart: (value) => {
        set({ dayStart: value, dayEnd: subtractMinutesFromTime(value, 1) })
        saveSettings(get())
    },

    setDayBottomSpace: (value) => {
        set({ dayBottomSpace: value })
        saveSettings(get())
    },

    setShowWeekNumbers: (value) => {
        set({ showWeekNumbers: value })
        saveSettings(get())
    },

    setShowExtraDays: (value) => {
        set({ showExtraDays: value })
        saveSettings(get())
    },

    setWorkweek: (value) => {
        set({ workweek: value })
        saveSettings(get())
    },

    setScrollToNow: (value) => {
        set({ scrollToNow: value })
        saveSettings(get())
    },

    setAutoStart: async (enabled) => {
        await window.electronAPI.system.setAutoStart(enabled)
        set({ autoStart: enabled })
    },

    initAutoStart: async () => {
        try {
            const enabled = await window.electronAPI.system.isAutoStartEnabled()
            set({ autoStart: enabled })
        } catch {
            // 忽略
        }
    }
}))

// 启动时应用已保存的主题
applyTheme(initial.theme)

// 系统主题变化时跟随（仅在“跟随系统”模式下）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useSettingsStore.getState().theme === 'system') applyTheme('system')
})
