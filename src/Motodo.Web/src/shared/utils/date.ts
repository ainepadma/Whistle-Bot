/**
 * 日期工具函数（主进程 & 渲染进程共享）
 * 纯函数，不依赖任何平台 API
 */

/**
 * 获取指定日期所在周的周一
 */
export function getWeekStart(date: Date, weekStartsOn: 0 | 1 = 1): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = (day - weekStartsOn + 7) % 7
    d.setDate(d.getDate() - diff)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * 获取星期标签（按周起始日排序），供月/周/小日历共用
 */
export function getWeekdayLabels(weekStartsOn: 0 | 1 = 1): string[] {
    return weekStartsOn === 1
        ? ['一', '二', '三', '四', '五', '六', '日']
        : ['日', '一', '二', '三', '四', '五', '六']
}

/**
 * 获取指定日期所在周的周日
 */
export function getWeekEnd(date: Date, weekStartsOn: 0 | 1 = 1): Date {
    const start = getWeekStart(date, weekStartsOn)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
}

/**
 * 获取指定月份的第一天
 */
export function getMonthStart(date: Date): Date {
    const d = new Date(date.getFullYear(), date.getMonth(), 1)
    return d
}

/**
 * 获取日历月视图所需的完整日期网格（含上月/下月填充日）
 * 返回 6 行 × 7 列 = 42 天的数组
 */
export function getMonthGrid(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
    const monthStart = getMonthStart(date)
    const diff = (monthStart.getDay() - weekStartsOn + 7) % 7
    const gridStart = new Date(monthStart)
    gridStart.setDate(gridStart.getDate() - diff)

    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart)
        d.setDate(d.getDate() + i)
        days.push(d)
    }
    return days
}

/**
 * 判断两个日期是否是同一天
 */
export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

/**
 * 判断日期是否为今天
 */
export function isToday(date: Date): boolean {
    return isSameDay(date, new Date())
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * 从 HH:mm 时间向前减去若干分钟（自动跨天回绕）
 */
export function subtractMinutesFromTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number)
    const total = (((h || 0) * 60 + (m || 0) - minutes) % 1440 + 1440) % 1440
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * 获取 ISO 周数（周一对齐，用于月视图周数列）
 */
export function getIsoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
