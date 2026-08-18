import type { ClassPeriod, WeekdayClassCount } from '../types/semester'
import type { SemesterCreateInput } from '../types/semester'

/** 预设学期定义 */
export interface SemesterPreset {
    id: string
    name: string
    label: string           // 简短标签
    startDate: string       // YYYY-MM-DD
    weeks: number
    periods: ClassPeriod[]
    weekdayCount: WeekdayClassCount
}

/** 13节课标准作息（含午休、晚课） */
const PERIODS_13: ClassPeriod[] = [
    { period: 1, name: '第1节', start: '08:00', end: '08:45' },
    { period: 2, name: '第2节', start: '08:50', end: '09:35' },
    { period: 3, name: '第3节', start: '09:50', end: '10:35' },
    { period: 4, name: '第4节', start: '10:40', end: '11:25' },
    { period: 5, name: '第5节', start: '11:30', end: '12:15' },
    { period: 6, name: '第6节', start: '14:00', end: '14:45' },
    { period: 7, name: '第7节', start: '14:50', end: '15:35' },
    { period: 8, name: '第8节', start: '15:50', end: '16:35' },
    { period: 9, name: '第9节', start: '16:40', end: '17:25' },
    { period: 10, name: '第10节', start: '17:30', end: '18:15' },
    { period: 11, name: '第11节', start: '19:00', end: '19:45' },
    { period: 12, name: '第12节', start: '19:50', end: '20:35' },
    { period: 13, name: '第13节', start: '20:40', end: '21:25' },
]

const WEEKDAY_FULL: WeekdayClassCount = { 1: 13, 2: 13, 3: 13, 4: 13, 5: 13, 6: 0, 7: 0 }

export const SEMESTER_PRESETS: SemesterPreset[] = [
    {
        id: 'summer-2026',
        name: '2026暑期学校',
        label: '暑期学校',
        startDate: '2026-08-24',
        weeks: 4,
        periods: PERIODS_13,
        weekdayCount: WEEKDAY_FULL,
    },
    {
        id: 'fall-2026',
        name: '2026-2027秋季学期',
        label: '秋季学期',
        startDate: '2026-09-21',
        weeks: 18,
        periods: PERIODS_13,
        weekdayCount: WEEKDAY_FULL,
    },
]

/** 预设对应的创建输入 */
export function presetToCreateInput(preset: SemesterPreset): SemesterCreateInput {
    return {
        name: preset.name,
        start_date: preset.startDate,
        weeks: preset.weeks,
        periods: preset.periods.map(p => ({ ...p })),
        weekday_count: { ...preset.weekdayCount },
    }
}
