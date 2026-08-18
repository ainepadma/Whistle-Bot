import { useState, useEffect, useCallback } from 'react'

/**
 * 更新状态机
 */
export type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'ready'
    | 'error'

export interface UpdateProgress {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
}

interface UpdaterState {
    status: UpdateStatus
    version: string | null
    progress: UpdateProgress | null
    error: string | null
}

/**
 * 自动更新 Hook
 * - 监听主进程 update:* 事件
 * - 暴露 check/download/install 操作
 */
export function useUpdater() {
    const [state, setState] = useState<UpdaterState>({
        status: 'idle',
        version: null,
        progress: null,
        error: null
    })

    useEffect(() => {
        const unsubs: (() => void)[] = []

        unsubs.push(
            window.electronAPI.on('update:checking', () => {
                setState(s => ({ ...s, status: 'checking', error: null }))
            })
        )

        unsubs.push(
            window.electronAPI.on('update:available', (data: unknown) => {
                const info = data as { version: string }
                setState(s => ({ ...s, status: 'available', version: info.version }))
            })
        )

        unsubs.push(
            window.electronAPI.on('update:not-available', () => {
                setState(s => ({ ...s, status: 'not-available' }))
            })
        )

        unsubs.push(
            window.electronAPI.on('update:progress', (data: unknown) => {
                const progress = data as UpdateProgress
                setState(s => ({ ...s, status: 'downloading', progress }))
            })
        )

        unsubs.push(
            window.electronAPI.on('update:ready', (data: unknown) => {
                const info = data as { version: string }
                setState(s => ({ ...s, status: 'ready', version: info.version, progress: null }))
            })
        )

        unsubs.push(
            window.electronAPI.on('update:error', (data: unknown) => {
                const info = data as { message: string }
                setState(s => ({ ...s, status: 'error', error: info.message }))
            })
        )

        return () => unsubs.forEach(fn => fn())
    }, [])

    const checkForUpdates = useCallback(async () => {
        setState(s => ({ ...s, status: 'checking', error: null }))
        try {
            await window.electronAPI.updater.check()
        } catch (err) {
            setState(s => ({
                ...s,
                status: 'error',
                error: err instanceof Error ? err.message : '检查更新失败'
            }))
        }
    }, [])

    const downloadUpdate = useCallback(async () => {
        setState(s => ({ ...s, status: 'downloading', error: null }))
        try {
            await window.electronAPI.updater.download()
        } catch (err) {
            setState(s => ({
                ...s,
                status: 'error',
                error: err instanceof Error ? err.message : '下载更新失败'
            }))
        }
    }, [])

    const installUpdate = useCallback(() => {
        window.electronAPI.updater.install()
    }, [])

    return {
        ...state,
        checkForUpdates,
        downloadUpdate,
        installUpdate
    }
}
