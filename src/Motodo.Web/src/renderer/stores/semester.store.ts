import { create } from 'zustand'
import type { Semester, SemesterCreateInput, SemesterUpdateInput } from '@shared/types/semester'
import { DEFAULT_PERIODS, DEFAULT_WEEKDAY_COUNT } from '@shared/types/semester'

interface SemesterStore {
    semesters: Semester[]
    activeSemester: Semester | null
    loading: boolean

    loadSemesters: () => Promise<void>
    createSemester: (data: SemesterCreateInput) => Promise<Semester>
    updateSemester: (id: string, data: SemesterUpdateInput) => Promise<Semester>
    removeSemester: (id: string) => Promise<void>
    setActive: (id: string) => Promise<void>
}

export const useSemesterStore = create<SemesterStore>((set, get) => ({
    semesters: [],
    activeSemester: null,
    loading: false,

    loadSemesters: async () => {
        set({ loading: true })
        try {
            const semesters = await window.electronAPI.semester.list()
            const active = (await window.electronAPI.semester.getActive()) ?? null
            set({ semesters, activeSemester: active, loading: false })
        } catch {
            set({ loading: false })
        }
    },

    createSemester: async (data) => {
        // 未提供课节配置时使用默认值
        const input = {
            ...data,
            periods: data.periods ?? DEFAULT_PERIODS,
            weekday_count: data.weekday_count ?? DEFAULT_WEEKDAY_COUNT
        }
        const sem = await window.electronAPI.semester.create(input)
        await get().loadSemesters()
        return sem
    },

    updateSemester: async (id, data) => {
        const sem = await window.electronAPI.semester.update(id, data)
        await get().loadSemesters()
        return sem
    },

    removeSemester: async (id) => {
        await window.electronAPI.semester.remove(id)
        await get().loadSemesters()
    },

    setActive: async (id) => {
        await window.electronAPI.semester.update(id, { is_active: true })
        await get().loadSemesters()
    }
}))
