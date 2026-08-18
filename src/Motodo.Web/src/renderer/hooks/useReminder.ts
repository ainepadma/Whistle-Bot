import { useState, useEffect, useCallback } from 'react'
import type { Reminder } from '@shared/types/reminder'

/**
 * 提醒状态监听 Hook
 */
export function useReminder() {
    const [reminders, setReminders] = useState<Reminder[]>([])
    const [showAlert, setShowAlert] = useState(false)

    const checkPending = useCallback(async () => {
        try {
            const pending = await window.electronAPI.reminder.getPending()
            setReminders(pending)
            setShowAlert(pending.length > 0)
        } catch {
            // 忽略
        }
    }, [])

    // 监听主进程推送的提醒事件
    useEffect(() => {
        const unsub = window.electronAPI.on('reminder:triggered', () => {
            checkPending()
        })
        return unsub
    }, [checkPending])

    // 初次加载
    useEffect(() => {
        checkPending()
    }, [checkPending])

    const dismiss = useCallback(async (id: string) => {
        await window.electronAPI.reminder.dismiss(id)
        setReminders(prev => prev.filter(r => r.id !== id))
        setShowAlert(_prev => {
            const remaining = reminders.filter(r => r.id !== id)
            return remaining.length > 0
        })
    }, [reminders])

    const snooze = useCallback(async (id: string, minutes: number) => {
        await window.electronAPI.reminder.snooze(id, minutes)
        setReminders(prev => prev.filter(r => r.id !== id))
        setShowAlert(false)
    }, [])

    return { reminders, showAlert, dismiss, snooze, setShowAlert }
}
