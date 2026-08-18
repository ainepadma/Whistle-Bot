import { useEffect, useState, useCallback } from 'react'
import { useSemesterStore } from '@/stores/semester.store'
import type { Semester, ClassPeriod, WeekdayClassCount } from '@shared/types/semester'
import { DEFAULT_PERIODS, DEFAULT_WEEKDAY_COUNT } from '@shared/types/semester'
import { SEMESTER_PRESETS } from '@shared/constants/semester-presets'
import dayjs from 'dayjs'

interface Props {
    onBack: () => void
}

export default function SemesterPage({ onBack }: Props): JSX.Element {
    const { semesters, activeSemester, loading, loadSemesters, createSemester, updateSemester, removeSemester, setActive } = useSemesterStore()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // 表单状态
    const [name, setName] = useState('')
    const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
    const [weeks, setWeeks] = useState(18)
    const [periods, setPeriods] = useState<ClassPeriod[]>([...DEFAULT_PERIODS])
    const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5])  // 周一~周五
    const [dailyPeriods, setDailyPeriods] = useState(13)
    const [specialWeeks, setSpecialWeeks] = useState<Record<number, 'exam' | 'holiday'>>({})

    const toggleDay = useCallback((day: number) => {
        setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())
    }, [])

    const cycleSpecialWeek = useCallback((week: number) => {
        setSpecialWeeks((prev) => {
            const cur = prev[week]
            if (cur === 'exam') {
                const next: Record<number, 'exam' | 'holiday'> = {}
                for (const [k, v] of Object.entries(prev)) {
                    if (Number(k) !== week) next[Number(k)] = v as 'exam' | 'holiday'
                }
                return next
            }
            return { ...prev, [week]: cur === undefined ? 'exam' : 'holiday' }
        })
    }, [])

    useEffect(() => {
        loadSemesters()
    }, [loadSemesters])

    const resetForm = useCallback(() => {
        setName('')
        setStartDate(dayjs().format('YYYY-MM-DD'))
        setWeeks(18)
        setPeriods([...DEFAULT_PERIODS])
        setActiveDays([1, 2, 3, 4, 5])
        setDailyPeriods(13)
        setSpecialWeeks({})
        setEditingId(null)
        setShowForm(false)
    }, [])

    const handleEdit = useCallback((sem: Semester) => {
        setName(sem.name)
        setStartDate(sem.start_date)
        setWeeks(sem.weeks)
        setPeriods(sem.periods ?? [...DEFAULT_PERIODS])
        const wc = sem.weekday_count ?? DEFAULT_WEEKDAY_COUNT
        const days = Object.entries(wc).filter(([, v]) => v > 0).map(([k]) => Number(k))
        setActiveDays(days.length > 0 ? days : [1, 2, 3, 4, 5])
        setDailyPeriods(wc[days[0]] ?? 13)
        setSpecialWeeks((sem.special_weeks ?? {}) as Record<number, 'exam' | 'holiday'>)
        setEditingId(sem.id)
        setShowForm(true)
    }, [])

    const applyPreset = useCallback((presetId: string) => {
        const preset = SEMESTER_PRESETS.find(p => p.id === presetId)
        if (!preset) return
        setName(preset.name)
        setStartDate(preset.startDate)
        setWeeks(preset.weeks)
        setPeriods(preset.periods.map(p => ({ ...p })))
        setActiveDays([1, 2, 3, 4, 5])
        setDailyPeriods(preset.periods.length)
        setSpecialWeeks({})
        setShowForm(true)
        setEditingId(null)
    }, [])

    const handleSubmit = useCallback(async () => {
        if (!name.trim()) return
        const wc: WeekdayClassCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
        activeDays.forEach(d => { wc[d] = dailyPeriods })
        if (editingId) {
            await updateSemester(editingId, {
                name: name.trim(),
                start_date: startDate,
                weeks,
                periods,
                weekday_count: wc,
                special_weeks: specialWeeks
            })
        } else {
            await createSemester({
                name: name.trim(),
                start_date: startDate,
                weeks,
                periods,
                weekday_count: wc,
                special_weeks: specialWeeks
            })
        }
        resetForm()
    }, [name, startDate, weeks, periods, activeDays, dailyPeriods, specialWeeks, editingId, createSemester, updateSemester, resetForm])

    const handleDelete = useCallback(async (id: string) => {
        await removeSemester(id)
    }, [removeSemester])

    const handleSetActive = useCallback(async (id: string) => {
        await setActive(id)
    }, [setActive])

    const updatePeriod = useCallback((idx: number, field: keyof ClassPeriod, value: string | number) => {
        setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
    }, [])

    const addPeriod = useCallback(() => {
        setPeriods(prev => {
            const last = prev[prev.length - 1]
            const [eh, em] = last.end.split(':').map(Number)
            const newStartMin = eh * 60 + em + 10 // 上节课结束后 10 分钟
            const newEndMin = newStartMin + 45
            const sh = Math.floor(newStartMin / 60)
            const sm = newStartMin % 60
            const eh2 = Math.floor(newEndMin / 60)
            const em2 = newEndMin % 60
            const newPeriod: ClassPeriod = {
                period: prev.length + 1,
                name: `第${prev.length + 1}节`,
                start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
                end: `${String(eh2).padStart(2, '0')}:${String(em2).padStart(2, '0')}`
            }
            return [...prev, newPeriod]
        })
    }, [])

    const removePeriod = useCallback((idx: number) => {
        setPeriods(prev => {
            if (prev.length <= 1) return prev
            const next = prev.filter((_, i) => i !== idx)
            // 重新编号
            return next.map((p, i) => ({ ...p, period: i + 1, name: `第${i + 1}节` }))
        })
    }, [])

    // ─── UI ───

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="ui-page-header">
                <button onClick={onBack} className="ui-icon-button">
                    ←
                </button>
                <div>
                    <h2 className="ui-page-title">学期管理</h2>
                    <p className="ui-page-description">配置学期范围、教学周与上课节次</p>
                </div>
                <div className="flex-1" />
                {!showForm && (
                    <>
                        <div className="flex gap-2 mr-2">
                            {SEMESTER_PRESETS.map(p => (
                                <button key={p.id} onClick={() => applyPreset(p.id)}
                                    className="px-3 py-1.5 text-xs border border-amber-300 dark:border-amber-700
                                     text-amber-700 dark:text-amber-300 rounded-lg
                                     hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors">
                                    📋 {p.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { resetForm(); setShowForm(true) }}
                            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                            新建学期
                        </button>
                    </>
                )}
            </div>

            <div className="ui-page-content space-y-6">
                {/* 表单 */}
                {showForm && (
                    <section className="ui-card p-5 space-y-4">
                        <h3 className="font-semibold">{editingId ? '编辑学期' : '新建学期'}</h3>

                        {/* 基本信息 */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">学期名称</label>
                                <input value={name} onChange={e => setName(e.target.value)}
                                    placeholder="如 2025-2026 第一学期"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">持续周数</label>
                                <input type="number" value={weeks} onChange={e => setWeeks(Number(e.target.value))}
                                    min={1} max={30}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                        </div>

                        <p className="text-xs text-gray-400">
                            结束日期：{dayjs(startDate).add(weeks * 7 - 1, 'day').format('YYYY-MM-DD')}
                        </p>

                        {/* 上课日 + 统一节数 */}
                        <div className="flex items-center gap-6">
                            <div>
                                <label className="text-xs text-gray-500 mb-2 block">上课日</label>
                                <div className="flex gap-1.5">
                                    {['一', '二', '三', '四', '五', '六', '日'].map((name, i) => {
                                        const day = i + 1
                                        const on = activeDays.includes(day)
                                        return (
                                            <button key={day} onClick={() => toggleDay(day)}
                                                className={`w-8 h-8 text-xs rounded-lg border transition-colors
                          ${on ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                                {name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-2 block">每天节数</label>
                                <input type="number" value={dailyPeriods} onChange={e => setDailyPeriods(Math.max(1, Number(e.target.value)))}
                                    min={1} max={20}
                                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-center" />
                            </div>
                        </div>

                        {/* 课节时间配置 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-gray-500">每节课起止时间（{periods.length} 节）</label>
                                <button onClick={addPeriod}
                                    className="px-2.5 py-1 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                                    + 添加一节
                                </button>
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                {periods.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <span className="w-12 text-gray-400 text-xs">{p.name}</span>
                                        <input value={p.start} onChange={e => updatePeriod(i, 'start', e.target.value)}
                                            type="time"
                                            className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs" />
                                        <span className="text-gray-400">—</span>
                                        <input value={p.end} onChange={e => updatePeriod(i, 'end', e.target.value)}
                                            type="time"
                                            className="w-28 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs" />
                                        {periods.length > 1 && (
                                            <button onClick={() => removePeriod(i)}
                                                className="ml-1 w-5 h-5 flex items-center justify-center text-xs rounded-full border border-red-300 dark:border-red-700 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 特殊周次 */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-2">
                                特殊周次（点击切换：正常 → 考试 → 假期，考试/假期周不上课）
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
                                    const state = specialWeeks[w]
                                    return (
                                        <button
                                            key={w}
                                            type="button"
                                            onClick={() => cycleSpecialWeek(w)}
                                            className={`w-9 h-9 text-xs rounded-lg border transition-colors
                                                ${state === 'exam'
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : state === 'holiday'
                                                        ? 'bg-red-500 text-white border-red-500'
                                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            {w}
                                            {state ? (state === 'exam' ? '考' : '假') : ''}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSubmit}
                                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                                {editingId ? '保存修改' : '创建学期'}
                            </button>
                            <button onClick={resetForm}
                                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                取消
                            </button>
                        </div>
                    </section>
                )}

                {/* 学期列表 */}
                <section>
                    <h3 className="ui-section-title mb-3">
                        学期列表 {loading && '(加载中...)'}
                    </h3>
                    {semesters.length === 0 && !loading && (
                        <p className="text-sm text-gray-400 py-4">暂无学期，点击上方按钮创建</p>
                    )}
                    <div className="space-y-3">
                        {semesters.map(sem => {
                            const isActive = activeSemester?.id === sem.id
                            return (
                                <div key={sem.id}
                                    className={`rounded-xl border p-4 transition-colors
                    ${isActive
                                            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950'
                                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium">{sem.name}</h4>
                                                {isActive && (
                                                    <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                                                        当前学期
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {sem.start_date} — {sem.end_date} · {sem.weeks} 周
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                每日 {sem.weekday_count?.[1] ?? sem.periods?.length ?? '-'} 节
                                                {' · '}
                                                {Object.entries(sem.weekday_count ?? {}).filter(([, v]) => v > 0).map(([k]) =>
                                                    ['', '一', '二', '三', '四', '五', '六', '日'][Number(k)]
                                                ).join('、')}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            {!isActive && (
                                                <button onClick={() => handleSetActive(sem.id)}
                                                    className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                                    设为当前
                                                </button>
                                            )}
                                            <button onClick={() => handleEdit(sem)}
                                                className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                                编辑
                                            </button>
                                            <button onClick={() => handleDelete(sem.id)}
                                                className="px-2.5 py-1.5 text-xs border border-red-300 dark:border-red-800 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            </div>
        </div>
    )
}
