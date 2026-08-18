import { create } from 'zustand'
import type { SpecialDate, SpecialDateCreateInput } from '@shared/types/special-date'

interface SpecialDatesStore {
    items: SpecialDate[]
    loading: boolean
    loadAll: () => Promise<void>
    add: (input: SpecialDateCreateInput) => Promise<void>
    remove: (id: string) => Promise<void>
}

export const useSpecialDatesStore = create<SpecialDatesStore>((set) => ({
    items: [],
    loading: false,

    loadAll: async () => {
        set({ loading: true })
        try {
            const items = await window.electronAPI.specialDate.list()
            set({ items, loading: false })
        } catch {
            set({ loading: false })
        }
    },

    add: async (input) => {
        await window.electronAPI.specialDate.create(input)
        await useSpecialDatesStore.getState().loadAll()
    },

    remove: async (id) => {
        await window.electronAPI.specialDate.remove(id)
        await useSpecialDatesStore.getState().loadAll()
    }
}))
