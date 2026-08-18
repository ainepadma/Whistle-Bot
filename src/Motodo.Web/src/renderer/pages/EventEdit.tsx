import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import type { EventCreateInput, Event, EventType } from '@shared/types/event'
import { useSemesterStore } from '@/stores/semester.store'
import { useCourseStore } from '@/stores/course.store'
import { useCourseCalendarStore } from '@/stores/course-calendar.store'
import { COURSE_COLORS } from '@shared/types/course'
import ScheduleTimeFields from '@/components/ScheduleTimeFields'

interface EventEditProps {
    event?: Event // 编辑模式传入已有日程
    onSave: (data: EventCreateInput) => Promise<void>
    onCancel: () => void
    onCourseCreated?: () => void
    initialType?: EditItemType
    initialStartAt?: string
    initialEndAt?: string
    initialIsAllDay?: boolean
}

type EditItemType = EventType | 'course'

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

type WeekPreset = 'all' | 'odd' | 'even' | 'first8' | 'last8'
type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly'

const WEEK_PRESET_OPTIONS: { key: WeekPreset; label: string }[] = [
    { key: 'all', label: '全学期' },
    { key: 'odd', label: '单周' },
    { key: 'even', label: '双周' },
    { key: 'first8', label: '前8周' },
    { key: 'last8', label: '后8周' }
]

function repeatFrequencyFromRule(rule: string | null | undefined): RepeatFrequency {
    const frequency = rule?.match(/(?:^|;)FREQ=([A-Z]+)/i)?.[1]?.toLowerCase()
    return frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly' ? frequency : 'none'
}

function generateWeeks(preset: WeekPreset, totalWeeks: number): number[] {
    switch (preset) {
        case 'all':
            return Array.from({ length: totalWeeks }, (_, i) => i + 1)
        case 'odd':
            return Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 1)
        case 'even':
            return Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 0)
        case 'first8':
            return Array.from({ length: Math.min(8, totalWeeks) }, (_, i) => i + 1)
        case 'last8':
            return Array.from(
                { length: Math.min(8, totalWeeks) },
                (_, i) => totalWeeks - Math.min(8, totalWeeks) + i + 1
            )
    }
}

export default function EventEdit({
    event,
    onSave,
    onCancel,
    onCourseCreated,
    initialType,
    initialStartAt,
    initialEndAt,
    initialIsAllDay
}: EventEditProps): JSX.Element {
    const semesters = useSemesterStore((s) => s.semesters)
    const activeSemester = useSemesterStore((s) => s.activeSemester)
    const loadSemesters = useSemesterStore((s) => s.loadSemesters)
    const createCourse = useCourseStore((s) => s.createCourse)

    const [title, setTitle] = useState(event?.title || '')
    const [startAt, setStartAt] = useState(() =>
        event
            ? dayjs(event.start_at).format('YYYY-MM-DDTHH:mm')
            : initialStartAt
                ? dayjs(initialStartAt).format('YYYY-MM-DDTHH:mm')
                : dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm')
    )
    const [endAt, setEndAt] = useState(() =>
        event
            ? dayjs(event.end_at).format('YYYY-MM-DDTHH:mm')
            : initialEndAt
                ? dayjs(initialEndAt).format('YYYY-MM-DDTHH:mm')
                : dayjs().add(2, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm')
    )
    const [isAllDay, setIsAllDay] = useState(event?.is_all_day || initialIsAllDay || false)
    const [itemType, setItemType] = useState<EditItemType>(event?.item_type ?? initialType ?? 'plan')
    const [description, setDescription] = useState(event?.description || '')
    const [location, setLocation] = useState(event?.location || '')
    const [reminderMinutes, setReminderMinutes] = useState(event?.reminders?.[0]?.minutes ?? 0)
    const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>(() => repeatFrequencyFromRule(event?.rrule_str))
    const [saving, setSaving] = useState(false)

    // 学期节次快捷填充（计划/待办）
    const [periodDate, setPeriodDate] = useState(dayjs().format('YYYY-MM-DD'))
    const [periodNo, setPeriodNo] = useState(1)

    // 课程模式字段
    const [courseSemesterId, setCourseSemesterId] = useState('')
    const [courseWeekday, setCourseWeekday] = useState(1)
    const [coursePeriods, setCoursePeriods] = useState<number[]>([1])
    const [courseWeeksPreset, setCourseWeeksPreset] = useState<WeekPreset>('all')
    const [courseColor, setCourseColor] = useState(COURSE_COLORS[0])
    const [teacher, setTeacher] = useState('')

    useEffect(() => {
        if (semesters.length === 0) loadSemesters()
    }, [semesters.length, loadSemesters])

    useEffect(() => {
        if (!courseSemesterId && semesters.length > 0) {
            setCourseSemesterId(activeSemester?.id ?? semesters[0].id)
        }
    }, [semesters, activeSemester, courseSemesterId])

    const semester = semesters.find((s) => s.id === courseSemesterId) ?? activeSemester ?? null
    const periods = semester?.periods ?? []
    const totalWeeks = semester?.weeks ?? 18
    const periodNumbers =
        periods.length > 0 ? periods.map((p) => p.period) : Array.from({ length: 13 }, (_, i) => i + 1)

    const isCourseMode = itemType === 'course' && !event

    const togglePeriod = useCallback((p: number) => {
        setCoursePeriods((prev) =>
            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b)
        )
    }, [])

    const applyPeriodTime = (): void => {
        const period = periods.find((p) => p.period === periodNo)
        if (!period) return
        setStartAt(`${periodDate}T${period.start}`)
        if (itemType !== 'todo') {
            setEndAt(`${periodDate}T${period.end}`)
        }
    }

    const handleStartChange = useCallback((value: string) => setStartAt(value), [])
    const handleEndChange = useCallback((value: string) => setEndAt(value), [])

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault()
        if (!title.trim() || saving) return

        setSaving(true)
        try {
            if (isCourseMode) {
                const semesterId = courseSemesterId || activeSemester?.id
                if (!semesterId) return

                await createCourse({
                    semester_id: semesterId,
                    name: title.trim(),
                    slots: [
                        {
                            weekday: courseWeekday,
                            periods: coursePeriods,
                            weeks: generateWeeks(courseWeeksPreset, totalWeeks)
                        }
                    ],
                    location: location.trim() || undefined,
                    teacher: teacher.trim() || undefined,
                    color: courseColor
                })
                useCourseCalendarStore.getState().refresh()
                onCourseCreated?.()
                return
            }

            const isTodo = itemType === 'todo'
            const startIso = isAllDay
                ? new Date(`${startAt.slice(0, 10)}T00:00:00`).toISOString()
                : new Date(startAt).toISOString()
            let endIso: string
            if (isTodo && !isAllDay) {
                // 待办只有截止时间，结束时间 = 截止 + 1 分钟
                endIso = new Date(new Date(startIso).getTime() + 60 * 1000).toISOString()
            } else if (isAllDay) {
                endIso = new Date(`${startAt.slice(0, 10)}T23:59:59`).toISOString()
            } else {
                endIso = new Date(endAt).toISOString()
            }

            await onSave({
                calendar_id: event?.calendar_id || 'default',
                title: title.trim(),
                start_at: startIso,
                end_at: endIso,
                is_all_day: isAllDay,
                item_type: itemType === 'todo' ? 'todo' : 'plan',
                description: description.trim(),
                location: location.trim(),
                rrule_str: repeatFrequency === 'none' ? null : `FREQ=${repeatFrequency.toUpperCase()}`,
                reminders: reminderMinutes > 0 ? [{ minutes: reminderMinutes }] : []
            })
        } finally {
            setSaving(false)
        }
    }

    const typeOptions: { key: EditItemType; label: string }[] = event
        ? [
              { key: 'plan', label: '计划' },
              { key: 'todo', label: '待办' }
          ]
        : [
              { key: 'course', label: '课程' },
              { key: 'plan', label: '计划' },
              { key: 'todo', label: '待办' }
          ]

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* 标题 */}
            <div>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={isCourseMode ? '课程名称' : '日程标题'}
                    className="w-full px-4 py-2.5 text-lg rounded-xl border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-800 focus:outline-none focus:ring-2
                     focus:ring-primary-500/30 transition-all"
                    autoFocus
                    required
                />
            </div>

            {/* 日程类型 */}
            <div className="flex gap-2">
                {typeOptions.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setItemType(key)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
                            ${itemType === key
                                ? 'bg-primary-500 text-white border-primary-500'
                                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {isCourseMode ? (
                <>
                    {/* 学期 */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">所属学期</label>
                        <select
                            value={courseSemesterId}
                            onChange={e => setCourseSemesterId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm"
                        >
                            {semesters.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                    {activeSemester?.id === s.id ? '（当前）' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 上课日 + 周次 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">上课日</label>
                            <select
                                value={courseWeekday}
                                onChange={e => setCourseWeekday(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-sm"
                            >
                                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                                    <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">周次</label>
                            <select
                                value={courseWeeksPreset}
                                onChange={e => setCourseWeeksPreset(e.target.value as WeekPreset)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-sm"
                            >
                                {WEEK_PRESET_OPTIONS.map((o) => (
                                    <option key={o.key} value={o.key}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 节次 */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-2">节次（可多选）</label>
                        <div className="flex flex-wrap gap-1.5">
                            {periodNumbers.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => togglePeriod(p)}
                                    className={`w-8 h-8 text-xs rounded-lg border transition-colors
                                        ${coursePeriods.includes(p)
                                            ? 'bg-primary-500 text-white border-primary-500'
                                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 地点 / 老师 */}
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="教室"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm"
                        />
                        <input
                            type="text"
                            value={teacher}
                            onChange={e => setTeacher(e.target.value)}
                            placeholder="老师"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm"
                        />
                    </div>

                    {/* 颜色 */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-2">颜色</label>
                        <div className="flex gap-2">
                            {COURSE_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCourseColor(c)}
                                    className={`w-6 h-6 rounded-full transition-transform
                                        ${courseColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* 全天开关 */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAllDay}
                            onChange={e => setIsAllDay(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">全天</span>
                    </label>

                    {/* 时间：待办只有截止时间 */}
                    <ScheduleTimeFields
                        itemType={itemType === 'todo' ? 'todo' : 'plan'}
                        isAllDay={isAllDay}
                        startAt={startAt}
                        endAt={endAt}
                        onStartChange={handleStartChange}
                        onEndChange={handleEndChange}
                    />

                    {/* 提醒 */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">提醒</label>
                        <select
                            value={reminderMinutes}
                            onChange={e => setReminderMinutes(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm"
                        >
                            <option value={0}>不提醒</option>
                            <option value={5}>提前 5 分钟</option>
                            <option value={10}>提前 10 分钟</option>
                            <option value={15}>提前 15 分钟</option>
                            <option value={30}>提前 30 分钟</option>
                            <option value={60}>提前 1 小时</option>
                            <option value={1440}>提前 1 天</option>
                        </select>
                    </div>

                    {/* 重复 */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">重复</label>
                        <select
                            value={repeatFrequency}
                            onChange={e => setRepeatFrequency(e.target.value as RepeatFrequency)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm"
                        >
                            <option value="none">不重复</option>
                            <option value="daily">每天</option>
                            <option value="weekly">每周</option>
                            <option value="monthly">每月</option>
                        </select>
                        {repeatFrequency !== 'none' && reminderMinutes > 0 && (
                            <p className="mt-1 text-xs text-gray-400">会为未来 90 天内的每次重复日程创建提醒。</p>
                        )}
                    </div>

                    {/* 学期节次快捷填充 */}
                    {periods.length > 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-2">
                            <p className="text-xs text-gray-500">
                                {itemType === 'todo' ? '按学期节次填充截止时间' : '按学期节次填充时间'}
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={periodDate}
                                    onChange={e => setPeriodDate(e.target.value)}
                                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600
                                     bg-white dark:bg-gray-800 text-sm"
                                />
                                <select
                                    value={periodNo}
                                    onChange={e => setPeriodNo(Number(e.target.value))}
                                    className="w-24 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600
                                     bg-white dark:bg-gray-800 text-sm"
                                >
                                    {periods.map((p) => (
                                        <option key={p.period} value={p.period}>
                                            第{p.period}节 {p.start}-{p.end}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={applyPeriodTime}
                                    className="px-3 py-1.5 text-sm border border-primary-300 dark:border-primary-700
                                     text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50
                                     dark:hover:bg-primary-950 transition-colors"
                                >
                                    应用
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 地点 */}
                    <div>
                        <input
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="添加地点"
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2
                             focus:ring-primary-500/30 transition-all"
                        />
                    </div>

                    {/* 描述 */}
                    <div>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="添加描述"
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2
                             focus:ring-primary-500/30 transition-all resize-none"
                        />
                    </div>
                </>
            )}

            {/* 按钮 */}
            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={saving || !title.trim()}
                    className="px-5 py-2 text-sm bg-primary-500 text-white rounded-lg
                     hover:bg-primary-600 disabled:opacity-50 transition-colors"
                >
                    {saving ? '保存中...' : isCourseMode ? '创建课程' : '保存'}
                </button>
            </div>
        </form>
    )
}

