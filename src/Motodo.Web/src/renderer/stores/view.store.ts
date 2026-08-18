import { create } from 'zustand'
import { ViewType } from '@shared/constants/enums'
import { useSettingsStore } from './settings.store'
import dayjs from 'dayjs'

interface ViewStore {
    currentView: ViewType
    currentDate: string // ISO 8601

    setView: (view: ViewType) => void
    navigateDate: (date: Date) => void
    goNext: () => void
    goPrev: () => void
    goToday: () => void
}

export const useViewStore = create<ViewStore>((set, get) => ({
    currentView: useSettingsStore.getState().defaultView as ViewType,
    currentDate: new Date().toISOString(),

    setView: (view) => set({ currentView: view }),

    navigateDate: (date) => set({ currentDate: date.toISOString() }),

    goNext: () => {
        const { currentView, currentDate } = get()
        const d = dayjs(currentDate)
        switch (currentView) {
            case ViewType.MONTH:
                set({ currentDate: d.add(1, 'month').toISOString() })
                break
            case ViewType.WEEK:
                set({ currentDate: d.add(1, 'week').toISOString() })
                break
            case ViewType.DAY:
                set({ currentDate: d.add(1, 'day').toISOString() })
                break
        }
    },

    goPrev: () => {
        const { currentView, currentDate } = get()
        const d = dayjs(currentDate)
        switch (currentView) {
            case ViewType.MONTH:
                set({ currentDate: d.subtract(1, 'month').toISOString() })
                break
            case ViewType.WEEK:
                set({ currentDate: d.subtract(1, 'week').toISOString() })
                break
            case ViewType.DAY:
                set({ currentDate: d.subtract(1, 'day').toISOString() })
                break
        }
    },

    goToday: () => set({ currentDate: new Date().toISOString() })
}))
