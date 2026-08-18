// ═══════════════════════════════════════════
// 课程实体
// ═══════════════════════════════════════════

/** 课程的一个时段 */
export interface CourseSlot {
    weekday: number      // 1=周一 ~ 7=周日
    periods: number[]    // 占用的节次
    weeks: number[]      // 上课周次，空=全学期
}

export interface Course {
    id: string
    semester_id: string
    name: string
    location: string
    teacher: string
    color: string
    slots: CourseSlot[]      // 多时段，每个时段可独立设置星期/节次/周次
    created_at: string
    updated_at: string
}

/** 向后兼容的快捷访问 */
export function getCourseWeekdays(c: Course): number[] {
    return [...new Set(c.slots.map(s => s.weekday))].sort()
}

export function getCoursePeriods(c: Course): number[] {
    return [...new Set(c.slots.flatMap(s => s.periods))].sort((a, b) => a - b)
}

/** DB 原始行 */
export interface CourseRow {
    id: string
    semester_id: string
    name: string
    weekday: number
    start_period: number
    duration: number
    location: string
    teacher: string
    color: string
    weeks_json: string
    periods_json: string
    slots_json: string
    created_at: string
    updated_at: string
}

export interface CourseCreateInput {
    semester_id: string
    name: string
    slots: CourseSlot[]
    location?: string
    teacher?: string
    color?: string
}

export interface CourseUpdateInput {
    name?: string
    slots?: CourseSlot[]
    location?: string
    teacher?: string
    color?: string
}

/** 预定义课程颜色 */
export const COURSE_COLORS = [
    '#f59e0b', // 琥珀
    '#3b82f6', // 蓝
    '#10b981', // 绿
    '#ef4444', // 红
    '#8b5cf6', // 紫
    '#ec4899', // 粉
    '#06b6d4', // 青
    '#f97316', // 橙
]
