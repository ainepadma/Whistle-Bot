import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { useSpecialDatesStore } from '@/stores/special-dates.store'
import type { SpecialDateType } from '@shared/types/special-date'

interface Props {
    onBack: () => void
}

export default function CalendarSettingsPage({ onBack }: Props): JSX.Element {
    const { items, loading, loadAll, add, remove } = useSpecialDatesStore()
    const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
    const [type, setType] = useState<SpecialDateType>('holiday')
    const [label, setLabel] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        loadAll()
    }, [loadAll])

    const handleAdd = async (): Promise<void> => {
        if (!date || busy) return
        setBusy(true)
        try {
            await add({ date, type, label: label.trim() })
            setLabel('')
        } finally {
            setBusy(false)
        }
    }

    const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))

    return (
        <div className="flex flex-col h-full">
            <div className="ui-page-header">
                <button
                    onClick={onBack}
                    className="ui-icon-button"
                >
                    ←
                </button>
                <h2 className="ui-page-title">日历设置</h2>
                <p className="ui-page-description">标记节假日与特殊日期</p>
            </div>

            <div className="ui-page-content space-y-6">
                {/* 添加 */}
                <section className="space-y-3">
                    <h3 className="ui-section-title">添加标记</h3>
                    <div className="ui-card p-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-sm"
                            />
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as SpecialDateType)}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-sm"
                            >
                                <option value="holiday">节假日</option>
                                <option value="special">特殊日期</option>
                            </select>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="名称（如：国庆节）"
                                className="flex-1 min-w-40 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-sm"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={busy || !date}
                                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600
                                 disabled:opacity-50 transition-colors"
                            >
                                添加
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">同一日期重复添加会更新类型与名称</p>
                    </div>
                </section>

                {/* 列表 */}
                <section className="space-y-3">
                    <h3 className="ui-section-title">
                        已标记 {loading ? '' : `(${items.length})`}
                    </h3>
                    {sorted.length === 0 && !loading && (
                        <p className="text-sm text-gray-400 text-center py-6">暂无标记，添加后会在日历上显示</p>
                    )}
                    <div className="space-y-2">
                        {sorted.map((item) => (
                            <div
                                key={item.id}
                                className="ui-card flex items-center justify-between px-4 py-2.5"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded
                                            ${item.type === 'holiday'
                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                                                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                                            }`}
                                    >
                                        {item.type === 'holiday' ? '节假日' : '特殊日期'}
                                    </span>
                                    <span className="text-sm font-medium">{item.date}</span>
                                    {item.label && <span className="text-sm text-gray-500">{item.label}</span>}
                                </div>
                                <button
                                    onClick={() => remove(item.id)}
                                    className="px-2.5 py-1.5 text-xs border border-red-300 dark:border-red-800 text-red-500
                                     rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                >
                                    删除
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
