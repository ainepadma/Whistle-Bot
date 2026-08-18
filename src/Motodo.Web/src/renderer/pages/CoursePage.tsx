import { useEffect, useState, useCallback, useMemo } from 'react'
import { useCourseStore } from '@/stores/course.store'
import { useSemesterStore } from '@/stores/semester.store'
import type { Course } from '@shared/types/course'
import { COURSE_COLORS } from '@shared/types/course'

interface Props {
    onBack: () => void
}

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

type WeekPreset = 'all' | 'odd' | 'even' | 'first8' | 'last8' | 'custom'

const WEEK_PRESET_OPTIONS: { key: WeekPreset; label: string }[] = [
    { key: 'all', label: '全学期' },
    { key: 'odd', label: '单周' },
    { key: 'even', label: '双周' },
    { key: 'first8', label: '前8周' },
    { key: 'last8', label: '后8周' },
    { key: 'custom', label: '自定义' },
]

/** 根据模板和总周数生成周次数组 */
function generateWeeks(preset: WeekPreset, totalWeeks: number, customWeeks: number[]): number[] {
    switch (preset) {
        case 'all': return Array.from({ length: totalWeeks }, (_, i) => i + 1)
        case 'odd': return Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 1)
        case 'even': return Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 0)
        case 'first8': return Array.from({ length: Math.min(8, totalWeeks) }, (_, i) => i + 1)
        case 'last8': return Array.from({ length: Math.min(8, totalWeeks) }, (_, i) => totalWeeks - Math.min(8, totalWeeks) + i + 1)
        case 'custom': return customWeeks
    }
}

/** 根据周次数组反推模板类型 */
function detectPreset(weeks: number[], totalWeeks: number): WeekPreset {
    if (weeks.length === 0 || weeks.length === totalWeeks) return 'all'
    const allOdd = weeks.every(w => w % 2 === 1) && weeks.length === Math.ceil(totalWeeks / 2)
    if (allOdd) return 'odd'
    const allEven = weeks.every(w => w % 2 === 0) && weeks.length === Math.floor(totalWeeks / 2)
    if (allEven) return 'even'
    if (weeks.length === 8 && weeks[0] === 1 && weeks[7] === 8) return 'first8'
    if (weeks.length === 8 && weeks[0] === totalWeeks - 7 && weeks[7] === totalWeeks) return 'last8'
    return 'custom'
}

/** 单个时段的表单状态 */
interface SlotFormState {
    weekday: number
    periods: number[]
    weekPreset: WeekPreset
    customWeeksStr: string
}

function defaultSlot(): SlotFormState {
    return { weekday: 1, periods: [1, 2], weekPreset: 'all', customWeeksStr: '' }
}

function slotToCourseSlot(s: SlotFormState, totalWeeks: number): import('@shared/types/course').CourseSlot {
    const parsed = s.customWeeksStr.split(/[,，\s]+/).map(Number).filter(n => n >= 1 && n <= totalWeeks)
    return { weekday: s.weekday, periods: s.periods, weeks: generateWeeks(s.weekPreset, totalWeeks, parsed) }
}

export default function CoursePage({ onBack }: Props): JSX.Element {
    const { courses, loading, loadBySemester, createCourse, updateCourse, removeCourse } = useCourseStore()
    const { semesters, activeSemester, loadSemesters } = useSemesterStore()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [semesterId, setSemesterId] = useState('')
    const [name, setName] = useState('')
    const [slots, setSlots] = useState<SlotFormState[]>([defaultSlot()])
    const [location, setLocation] = useState('')
    const [teacher, setTeacher] = useState('')
    const [color, setColor] = useState(COURSE_COLORS[0])

    const selectedSemester = semesters.find(s => s.id === semesterId)
    const totalWeeks = selectedSemester?.weeks ?? 18
    const totalPeriods = Math.max(...(selectedSemester?.periods?.map(p => p.period) ?? [10]), 10)

    const updateSlot = useCallback((idx: number, patch: Partial<SlotFormState>) => {
        setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
    }, [])
    const toggleSlotPeriod = useCallback((idx: number, p: number) => {
        setSlots(prev => prev.map((s, i) => {
            if (i !== idx) return s
            const next = s.periods.includes(p) ? s.periods.filter(x => x !== p) : [...s.periods, p]
            return { ...s, periods: next.sort((a, b) => a - b) }
        }))
    }, [])
    const addSlot = useCallback(() => setSlots(prev => [...prev, defaultSlot()]), [])
    const removeSlotForm = useCallback((idx: number) => {
        setSlots(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
    }, [])

    const computedSlots = useMemo(() => slots.map(s => slotToCourseSlot(s, totalWeeks)), [slots, totalWeeks])

    useEffect(() => {
        loadSemesters()
    }, [loadSemesters])

    useEffect(() => {
        if (activeSemester) {
            setSemesterId(activeSemester.id)
            loadBySemester(activeSemester.id)
        } else if (semesters.length > 0) {
            setSemesterId(semesters[0].id)
            loadBySemester(semesters[0].id)
        }
    }, [activeSemester, semesters, loadBySemester])

    const handleSelectSemester = useCallback((id: string) => {
        setSemesterId(id)
        loadBySemester(id)
    }, [loadBySemester])

    const resetForm = useCallback(() => {
        setName('')
        setSlots([defaultSlot()])
        setLocation('')
        setTeacher('')
        setColor(COURSE_COLORS[0])
        setEditingId(null)
        setShowForm(false)
    }, [])

    const handleEdit = useCallback((c: Course) => {
        setName(c.name)
        setSlots(c.slots.length > 0
            ? c.slots.map(s => ({
                weekday: s.weekday,
                periods: s.periods.length > 0 ? [...s.periods] : [1, 2],
                weekPreset: detectPreset(s.weeks, totalWeeks),
                customWeeksStr: detectPreset(s.weeks, totalWeeks) === 'custom' ? s.weeks.join(', ') : ''
            }))
            : [defaultSlot()])
        setLocation(c.location)
        setTeacher(c.teacher)
        setColor(c.color)
        setEditingId(c.id)
        setShowForm(true)
    }, [totalWeeks])

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !semesterId || computedSlots.length === 0) return
        if (editingId) {
            await updateCourse(editingId, {
                name: name.trim(), slots: computedSlots,
                location: location.trim(), teacher: teacher.trim(), color
            })
        } else {
            await createCourse({
                semester_id: semesterId, name: name.trim(),
                slots: computedSlots,
                location: location.trim(), teacher: teacher.trim(), color
            })
        }
        resetForm()
    }, [name, semesterId, computedSlots, location, teacher, color, editingId, createCourse, updateCourse, resetForm])

    const handleDelete = useCallback(async (id: string) => {
        await removeCourse(id)
    }, [removeCourse])

    return (
        <div className="flex flex-col h-full">
            <div className="ui-page-header">
                <button onClick={onBack} className="ui-icon-button">←</button>
                <div>
                    <h2 className="ui-page-title">课程管理</h2>
                    <p className="ui-page-description">维护课程、上课时间和教学周</p>
                </div>
                <div className="flex-1" />
                {!showForm && (
                    <button onClick={() => { resetForm(); setShowForm(true) }}
                        className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                        添加课程
                    </button>
                )}
            </div>

            <div className="ui-page-content space-y-6">
                {/* 学期选择 */}
                <div className="flex gap-2">
                    {semesters.map(s => (
                        <button key={s.id} onClick={() => handleSelectSemester(s.id)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
                ${semesterId === s.id
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            {s.name}
                        </button>
                    ))}
                </div>

                {/* 表单 */}
                {showForm && (
                    <section className="ui-card p-5 space-y-4">
                        <h3 className="font-semibold">{editingId ? '编辑课程' : '添加课程'}</h3>
                        {/* 基本信息 */}
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">课程名称</label>
                                <input value={name} onChange={e => setName(e.target.value)}
                                    placeholder="如 高等数学"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">颜色</label>
                                <div className="flex gap-1 flex-wrap">
                                    {COURSE_COLORS.map(c => (
                                        <button key={c} onClick={() => setColor(c)}
                                            className={`w-7 h-7 rounded-full border-2 transition-colors ${color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">教室</label>
                                <input value={location} onChange={e => setLocation(e.target.value)}
                                    placeholder="如 教一楼301"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">教师</label>
                                <input value={teacher} onChange={e => setTeacher(e.target.value)}
                                    placeholder="如 张老师"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                            </div>
                        </div>

                        {/* 时段列表 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-gray-500">上课时段（{slots.length} 个）</label>
                                <button onClick={addSlot}
                                    className="px-2.5 py-1 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                                    + 添加时段
                                </button>
                            </div>
                            {slots.map((slot, idx) => (
                                <div key={idx} className="mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs text-gray-400 font-medium">时段 {idx + 1}</span>
                                        <select value={slot.weekday} onChange={e => updateSlot(idx, { weekday: Number(e.target.value) })}
                                            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                                            {WEEKDAY_NAMES.map((n, i) => i > 0 && <option key={i} value={i}>{n}</option>)}
                                        </select>
                                        {slots.length > 1 && (
                                            <button onClick={() => removeSlotForm(idx)}
                                                className="ml-auto w-5 h-5 flex items-center justify-center text-xs rounded-full border border-red-300 dark:border-red-700 text-red-400 hover:bg-red-50 dark:hover:bg-red-950">×</button>
                                        )}
                                    </div>
                                    {/* 节次选择 */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {Array.from({ length: totalPeriods }, (_, i) => i + 1).map(p => (
                                            <button key={p} onClick={() => toggleSlotPeriod(idx, p)}
                                                className={`w-7 h-6 text-[10px] rounded border transition-colors
                          ${slot.periods.includes(p) ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    {/* 周次模板 */}
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {WEEK_PRESET_OPTIONS.map(opt => (
                                            <button key={opt.key} onClick={() => updateSlot(idx, { weekPreset: opt.key })}
                                                className={`px-2 py-0.5 text-[10px] rounded border transition-colors
                        ${slot.weekPreset === opt.key ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {slot.weekPreset === 'custom' && (
                                        <input value={slot.customWeeksStr}
                                            onChange={e => updateSlot(idx, { customWeeksStr: e.target.value })}
                                            placeholder={`周次，逗号分隔（1-${totalWeeks}）`}
                                            className="mt-1.5 w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSubmit}
                                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                                {editingId ? '保存' : '添加'}
                            </button>
                            <button onClick={resetForm}
                                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                取消
                            </button>
                        </div>
                    </section>
                )}

                {/* 课程列表 */}
                <section>
                    <h3 className="ui-section-title mb-3">
                        课程列表 {loading ? '(加载中...)' : `(${courses.length})`}
                    </h3>
                    {courses.length === 0 && !loading && (
                        <p className="text-sm text-gray-400 py-4">暂无课程</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {courses.map(c => (
                            <div key={c.id}
                                className="ui-card p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                                        <h4 className="font-medium">{c.name}</h4>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(c)}
                                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800">编辑</button>
                                        <button onClick={() => handleDelete(c.id)}
                                            className="px-2 py-1 text-xs border border-red-300 dark:border-red-800 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950">删除</button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                                    {c.slots.map((s, i) => (
                                        <p key={i}>
                                            {WEEKDAY_NAMES[s.weekday]} 第{s.periods.length > 0 ? s.periods.join(',') : '-'}节
                                            {s.weeks.length > 0 && s.weeks.length < totalWeeks && (
                                                <span className="text-gray-400"> ({s.weeks.length}周)</span>
                                            )}
                                        </p>
                                    ))}
                                    {c.location && <p>📍 {c.location}</p>}
                                    {c.teacher && <p>👤 {c.teacher}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
