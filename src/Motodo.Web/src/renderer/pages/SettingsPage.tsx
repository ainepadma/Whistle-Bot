import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settings.store'
import type { UpdateProgress } from '@/hooks/useUpdater'

interface SettingsPageProps {
    onBack: () => void
}

export default function SettingsPage({ onBack }: SettingsPageProps): JSX.Element {
    const {
        theme, setTheme,
        weekStartsOn, setWeekStartsOn,
        timeFormat, setTimeFormat,
        defaultView, setDefaultView,
        dayStart, setDayStart,
        dayBottomSpace, setDayBottomSpace,
        showWeekNumbers, setShowWeekNumbers,
        showExtraDays, setShowExtraDays,
        workweek, setWorkweek,
        scrollToNow, setScrollToNow,
        autoStart, setAutoStart
    } = useSettingsStore()
    const initAutoStart = useSettingsStore((s) => s.initAutoStart)
    const [appVersion, setAppVersion] = useState('')
useEffect(() => {
        initAutoStart()
    }, [initAutoStart])

    useEffect(() => {
        window.electronAPI.system
            .getAppVersion()
            .then(setAppVersion)
            .catch(() => {})
    }, [])

    return (
        <div className="flex flex-col h-full">
            <div className="ui-page-header">
                <button
                    onClick={onBack}
                    className="ui-icon-button"
                >
                    ←
                </button>
                <div>
                    <h2 className="ui-page-title">设置</h2>
                    <p className="ui-page-description">调整外观、日历行为与系统偏好</p>
                </div>
            </div>

            <div className="ui-page-content space-y-6">
                {/* 外观 */}
                <section className="ui-card p-5">
                    <h3 className="ui-section-title mb-3">外观</h3>
                    <div className="space-y-3">
                        <SettingRow label="主题">
                            <select
                                value={theme}
                                onChange={e => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                           bg-white dark:bg-zinc-800 text-sm"
                            >
                                <option value="system">跟随系统</option>
                                <option value="light">浅色</option>
                                <option value="dark">深色</option>
                            </select>
                        </SettingRow>

                        <SettingRow label="每周开始于">
                            <select
                                value={weekStartsOn}
                                onChange={e => setWeekStartsOn(Number(e.target.value) as 0 | 1)}
                                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                           bg-white dark:bg-zinc-800 text-sm"
                            >
                                <option value={1}>周一</option>
                                <option value={0}>周日</option>
                            </select>
                        </SettingRow>

                        <SettingRow label="时间格式">
                            <select
                                value={timeFormat}
                                onChange={e => setTimeFormat(e.target.value as '12h' | '24h')}
                                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                           bg-white dark:bg-zinc-800 text-sm"
                            >
                                <option value="24h">24 小时制</option>
                                <option value="12h">12 小时制</option>
                            </select>
                        </SettingRow>

                        <SettingRow label="默认视图">
                            <select
                                value={defaultView}
                                onChange={e => setDefaultView(e.target.value as 'month' | 'week' | 'day')}
                                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                           bg-white dark:bg-zinc-800 text-sm"
                            >
                                <option value="month">月视图</option>
                                <option value="week">周视图</option>
                                <option value="day">日视图</option>
                            </select>
                        </SettingRow>
                    </div>
                </section>

                {/* 日历 */}
                <section className="ui-card p-5">
                    <h3 className="ui-section-title mb-3">日历</h3>
                    <div className="space-y-3">
                        <SettingRow label="每日起始时间">
                            <input
                                type="time"
                                value={dayStart}
                                onChange={e => setDayStart(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                                 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </SettingRow>
                        <SettingRow label="底部留白（分钟）">
                            <input
                                type="number"
                                value={dayBottomSpace}
                                onChange={e => setDayBottomSpace(Math.max(0, Number(e.target.value)))}
                                min={0}
                                max={240}
                                className="w-20 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600
                                 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </SettingRow>
                        <SettingRow label="月视图显示周数">
                            <Switch checked={showWeekNumbers} onChange={setShowWeekNumbers} />
                        </SettingRow>
                        <SettingRow label="月视图显示非本月日期">
                            <Switch checked={showExtraDays} onChange={setShowExtraDays} />
                        </SettingRow>
                        <SettingRow label="周视图仅显示工作日">
                            <Switch checked={workweek} onChange={setWorkweek} />
                        </SettingRow>
                        <SettingRow label="自动定位到当前时间">
                            <Switch checked={scrollToNow} onChange={setScrollToNow} />
                        </SettingRow>
                        <p className="text-xs text-zinc-400">只需设置每日起始时间，结束时间自动为次日起始前 1 分钟（如 04:00 → 次日 03:59）；底部留白为时间轴末端额外空间</p>
                    </div>
                </section>

                {/* 系统 */}
                <section className="ui-card p-5">
                    <h3 className="ui-section-title mb-3">系统</h3>
                    <div className="space-y-3">
                        <SettingRow label="开机自启">
                            <Switch checked={autoStart} onChange={setAutoStart} />
                        </SettingRow>
                    </div>
                </section>
                <section className="ui-card p-5">
                    <h3 className="ui-section-title mb-2">桌宠服务</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        日程、提醒和专注计时由小鹞 WhistleBot 统一管理。在线更新将在桌宠发行服务配置后提供。
                    </p>
                </section>

                {/* 关于 */}
                <section className="ui-card p-5">
                    <h3 className="ui-section-title mb-3">关于</h3>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
                        <p>小鹞 WhistleBot · 日程与专注 v{appVersion || '开发版'}</p>
                        <p>基于 .NET、WebView2、React 与 SQLite 构建</p>
                    </div>
                </section>
            </div>
        </div>
    )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
    return (
        <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800/70">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
            {children}
        </div>
    )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
    return (
        <button
            onClick={() => onChange(!checked)}
            role="switch"
            aria-checked={checked}
            className={`relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors
                ${checked ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-500'}`}
        >
            <span
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-950
                    ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    )
}
