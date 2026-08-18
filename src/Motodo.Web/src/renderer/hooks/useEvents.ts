import { useEffect } from 'react'
import { useViewStore } from '@/stores/view.store'
import { useEventStore } from '@/stores/event.store'
import { useCourseCalendarStore } from '@/stores/course-calendar.store'
import { useSemesterStore } from '@/stores/semester.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getWeekStart, getWeekEnd } from '@shared/utils/date'
import { ViewType } from '@shared/constants/enums'
import dayjs from 'dayjs'

/**
 * 根据当前视图和日期自动加载日程数据
 */
export function useEvents(): { loading: boolean; error: string | null } {
    const { currentView, currentDate } = useViewStore()
    const { loadEvents, loading, error } = useEventStore()
    const loadCourseItems = useCourseCalendarStore((s) => s.loadForRange)
    const activeSemesterId = useSemesterStore((s) => s.activeSemester?.id ?? null)
    const weekStartsOn = useSettingsStore((s) => s.weekStartsOn)

    useEffect(() => {
        const d = dayjs(currentDate)
        let start: Date
        let end: Date

        switch (currentView) {
            case ViewType.MONTH: {
                // 月视图需要加载前后各一周的缓冲
                start = new Date(d.startOf('month').subtract(7, 'day').toISOString())
                end = new Date(d.endOf('month').add(7, 'day').toISOString())
                break
            }
            case ViewType.WEEK: {
                start = getWeekStart(d.toDate(), weekStartsOn)
                end = getWeekEnd(d.toDate(), weekStartsOn)
                break
            }
            case ViewType.DAY: {
                start = new Date(d.startOf('day').toISOString())
                end = new Date(d.endOf('day').add(1, 'day').toISOString())
                break
            }
        }

        const range = {
            start: start.toISOString(),
            end: end.toISOString()
        }

        loadEvents(range)
        loadCourseItems(range)
    }, [currentView, currentDate, loadEvents, loadCourseItems, activeSemesterId, weekStartsOn])

    return { loading, error }
}
