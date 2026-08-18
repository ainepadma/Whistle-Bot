import { useState } from 'react'
import dayjs from 'dayjs'
import ScheduleTimeFields from '@/components/ScheduleTimeFields'
import Icon from '@/components/ui/Icons'

interface CreateCardProps {
    onCancel: () => void
    onSaved: () => void
}

/** 卡片模式专用的紧凑「新建日程」小卡片 */
export default function CreateCard({ onCancel, onSaved }: CreateCardProps): JSX.Element {
    const [title, setTitle] = useState('')
    const [itemType, setItemType] = useState<'plan' | 'todo'>('plan')
    const [isAllDay, setIsAllDay] = useState(false)
    const [startAt, setStartAt] = useState(() =>
        dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm')
    )
    const [endAt, setEndAt] = useState(() =>
        dayjs().add(2, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm')
    )
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!title.trim() || saving) return
        setSaving(true)
        try {
            const date = startAt.slice(0, 10)
            const startIso = isAllDay
                ? dayjs(`${date}T00:00`).toISOString()
                : new Date(startAt).toISOString()
            const endIso =
                itemType === 'todo' && !isAllDay
                    ? dayjs(startIso).add(1, 'minute').toISOString()
                    : isAllDay
                        ? dayjs(`${date}T23:59:59`).toISOString()
                        : new Date(endAt).toISOString()
            await window.electronAPI.event.create({
                calendar_id: 'default',
                title: title.trim(),
                start_at: startIso,
                end_at: endIso,
                is_all_day: isAllDay,
                item_type: itemType
            })
            onSaved()
        } finally {
            setSaving(false)
        }
    }

    const typeButton = (key: 'plan' | 'todo', label: string) => (
        <button
            onClick={() => setItemType(key)}
            className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors
                ${itemType === key
                    ? key === 'todo'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900'
                }`}
        >
            {label}
        </button>
    )

    return (
        <div
            className="mx-3 mb-3 max-h-[calc(100vh-3.75rem)] overflow-y-auto py-3"
        >
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">新建日程</span>
                <button
                    onClick={onCancel}
                    aria-label="取消新建"
                    title="取消新建"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400
                     transition-colors hover:bg-zinc-100 hover:text-zinc-700
                     dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                    <Icon name="close" className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="space-y-2.5">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="日程标题"
                    autoFocus
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs
                     text-zinc-800 outline-none transition-shadow focus:ring-2 focus:ring-primary-500/30
                     dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />

                <div className="flex gap-1.5">
                    {typeButton('plan', '计划')}
                    {typeButton('todo', '待办')}
                </div>

                <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <input
                        type="checkbox"
                        checked={isAllDay}
                        onChange={(e) => setIsAllDay(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-950"
                    />
                    全天
                </label>

                <ScheduleTimeFields
                    itemType={itemType}
                    isAllDay={isAllDay}
                    startAt={startAt}
                    endAt={endAt}
                    onStartChange={setStartAt}
                    onEndChange={setEndAt}
                />
            </div>

            <div className="mt-3 flex justify-end gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <button
                    onClick={onCancel}
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium
                     text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800
                     dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                    取消
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !title.trim()}
                    className="rounded-md bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-white
                     transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50
                     dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                    {saving ? '保存中…' : '保存'}
                </button>
            </div>
        </div>
    )
}
