import { create } from 'zustand'
import type { Course, CourseCreateInput, CourseUpdateInput } from '@shared/types/course'

interface CourseStore {
    courses: Course[]
    loading: boolean

    loadBySemester: (semesterId: string) => Promise<void>
    createCourse: (data: CourseCreateInput) => Promise<Course>
    updateCourse: (id: string, data: CourseUpdateInput) => Promise<Course>
    removeCourse: (id: string) => Promise<void>
}

export const useCourseStore = create<CourseStore>((set, get) => ({
    courses: [],
    loading: false,

    loadBySemester: async (semesterId) => {
        set({ loading: true })
        try {
            const courses = await window.electronAPI.course.listBySemester(semesterId)
            set({ courses, loading: false })
        } catch {
            set({ loading: false })
        }
    },

    createCourse: async (data) => {
        const course = await window.electronAPI.course.create(data)
        await get().loadBySemester(data.semester_id)
        return course
    },

    updateCourse: async (id, data) => {
        const course = await window.electronAPI.course.update(id, data)
        const current = get().courses.find(c => c.id === id)
        if (current) {
            await get().loadBySemester(current.semester_id)
        }
        return course
    },

    removeCourse: async (id) => {
        const current = get().courses.find(c => c.id === id)
        await window.electronAPI.course.remove(id)
        if (current) {
            await get().loadBySemester(current.semester_id)
        }
    }
}))
