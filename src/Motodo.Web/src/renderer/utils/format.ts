import type { Dayjs } from 'dayjs'

/** 按设置的时间格式（12/24 小时制）显示时刻 */
export function formatClock(time: Dayjs, format: '12h' | '24h'): string {
    return format === '12h' ? time.format('h:mm A') : time.format('HH:mm')
}
