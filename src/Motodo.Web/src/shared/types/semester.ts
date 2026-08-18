// ═══════════════════════════════════════════
// 学期实体 & 课节定义
// ═══════════════════════════════════════════

/** 单节课的时间定义 */
export interface ClassPeriod {
    period: number      // 第几节（1-based）
    name: string        // 显示名，如 "第1节"
    start: string       // HH:mm 如 "08:00"
    end: string         // HH:mm 如 "08:45"
}

/** 每天上课节数，key 为 ISO 星期数 1=周一 ~ 7=周日 */
export interface WeekdayClassCount {
    [weekday: number]: number
}

export interface Semester {
    id: string
    name: string
    start_date: string      // YYYY-MM-DD
    weeks: number
    end_date: string        // YYYY-MM-DD（自动计算）
    is_active: boolean

    // 运行时解析后的字段（主进程 service 返回时注入）
    periods?: ClassPeriod[]
    weekday_count?: WeekdayClassCount
    special_weeks?: Record<number, string>  // { weekNum: 'exam'|'holiday' }

    created_at: string
    updated_at: string
}

/** DB 中原始行（periods_json / weekday_count_json 为字符串） */
export interface SemesterRow {
    id: string
    name: string
    start_date: string
    weeks: number
    end_date: string
    is_active: number
    periods_json: string
    weekday_count_json: string
    special_weeks_json: string
    created_at: string
    updated_at: string
}

export interface SemesterCreateInput {
    name: string
    start_date: string      // YYYY-MM-DD
    weeks: number
    periods?: ClassPeriod[]
    weekday_count?: WeekdayClassCount
    special_weeks?: Record<number, string>  // { weekNum: 'exam'|'holiday' }
}

export interface SemesterUpdateInput {
    name?: string
    start_date?: string
    weeks?: number
    is_active?: boolean
    periods?: ClassPeriod[]
    weekday_count?: WeekdayClassCount
    special_weeks?: Record<number, string>
}

/** 默认课节配置（13节课标准作息） */
export const DEFAULT_PERIODS: ClassPeriod[] = [
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

/** 默认每天上课节数：周一~周五 13 节，周末 0 */
export const DEFAULT_WEEKDAY_COUNT: WeekdayClassCount = {
    1: 13, 2: 13, 3: 13, 4: 13, 5: 13, 6: 0, 7: 0
}
