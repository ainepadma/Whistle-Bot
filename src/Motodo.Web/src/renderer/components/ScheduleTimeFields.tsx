import { memo } from 'react'

interface ScheduleTimeFieldsProps {
    itemType: 'plan' | 'todo'
    isAllDay: boolean
    startAt: string // YYYY-MM-DDTHH:mm
    endAt: string
    onStartChange: (value: string) => void
    onEndChange: (value: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const inputClass =
    'px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 ' +
    'text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30'

/**
 * 日程时间选择：日期用轻量原生输入，时间用自定义「时/分」下拉（5 分钟粒度），
 * 避免 Electron 中原生时间下拉的卡顿与弹层穿模；整行布局防止字段互相挤压。
 */
function ScheduleTimeFields({
    itemType,
    isAllDay,
    startAt,
    endAt,
    onStartChange,
    onEndChange
}: ScheduleTimeFieldsProps): JSX.Element {
    if (itemType === 'todo') {
        return (
            <div>
                <label className="mb-1 block text-xs text-zinc-400">截止时间</label>
                <TimeRow value={startAt} isAllDay={isAllDay} onChange={onStartChange} />
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div>
                <label className="mb-1 block text-xs text-zinc-400">开始时间</label>
                <TimeRow value={startAt} isAllDay={isAllDay} onChange={onStartChange} />
            </div>
            <div>
                <label className="mb-1 block text-xs text-zinc-400">结束时间</label>
                <TimeRow value={endAt} isAllDay={isAllDay} onChange={onEndChange} />
            </div>
        </div>
    )
}

function TimeRow({
    value,
    isAllDay,
    onChange
}: {
    value: string
    isAllDay: boolean
    onChange: (v: string) => void
}): JSX.Element {
    if (isAllDay) {
        return (
            <input
                type="date"
                value={value.slice(0, 10)}
                onChange={(e) => onChange(`${e.target.value}T00:00`)}
                className={`${inputClass} w-full`}
                required
            />
        )
    }
    return (
        <div className="flex gap-2">
            <input
                type="date"
                value={value.slice(0, 10)}
                onChange={(e) => onChange(`${e.target.value}${value.slice(10)}`)}
                className={`${inputClass} min-w-0 flex-1`}
                required
            />
            <TimeSelect
                value={value.slice(11)}
                onChange={(time) => onChange(`${value.slice(0, 10)}T${time}`)}
            />
        </div>
    )
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
    const [hour, minute] = value.split(':')
    // 若当前分钟不是 5 的倍数（编辑旧数据），补一个占位选项避免下拉空白
    const minuteOptions = MINUTE_STEPS.includes(minute)
        ? MINUTE_STEPS
        : [minute, ...MINUTE_STEPS].sort()

    return (
        <div className="flex gap-1.5">
            <select
                value={hour}
                onChange={(e) => onChange(`${e.target.value}:${minute}`)}
                className={`${inputClass} w-[4.5rem] cursor-pointer`}
                aria-label="小时"
            >
                {HOURS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <select
                value={minute}
                onChange={(e) => onChange(`${hour}:${e.target.value}`)}
                className={`${inputClass} w-[4.5rem] cursor-pointer`}
                aria-label="分钟"
            >
                {minuteOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
        </div>
    )
}

export default memo(ScheduleTimeFields)
