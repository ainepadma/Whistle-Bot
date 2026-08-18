import { create } from 'zustand'
import { useSemesterStore } from './semester.store'
import { useCourseStore } from './course.store'
import { buildCourseInstances } from '@shared/utils/course-calendar'
import type { Event, DateRange } from '@shared/types/event'

interface CourseCalendarStore {
    items: Event[]
    loading: boolean
    loadForRange: (range: DateRange) => Promise<void>
    refresh: () => void
}

let lastRange: DateRange | null = null

export const useCourseCalendarStore = create<CourseCalendarStore>((set) => ({
    items: [],
    loading: false,

    loadForRange: async (range) => {
        lastRange = range
        const semesterStore = useSemesterStore.getState()
        if (semesterStore.semesters.length === 0 && !semesterStore.loading) {
            await semesterStore.loadSemesters()
        }

        const active = useSemesterStore.getState().activeSemester
        if (!active) {
            set({ items: [], loading: false })
            return
        }

        const courseStore = useCourseStore.getState()
        await courseStore.loadBySemester(active.id)
        const courses = useCourseStore.getState().courses
        set({
            items: buildCourseInstances(active, courses, range),
            loading: false
        })
    },

    refresh: () => {
        if (lastRange) {
            useCourseCalendarStore.getState().loadForRange(lastRange)
        }
    }
}))
