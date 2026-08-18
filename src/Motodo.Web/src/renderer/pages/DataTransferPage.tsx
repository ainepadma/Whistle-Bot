import { useState } from 'react'
import dayjs from 'dayjs'

interface Props {
    onBack: () => void
}

export default function DataTransferPage({ onBack }: Props): JSX.Element {
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const doExport = async (kind: 'ics' | 'json'): Promise<void> => {
        setBusy(true)
        setMessage(null)
        try {
            // 唯一日历：导出全部日程
            const content =
                kind === 'ics'
                    ? await window.electronAPI.export.ics([])
                    : await window.electronAPI.export.json([])
            const result = await window.electronAPI.export.saveFile({
                suggestedName: `日程-${dayjs().format('YYYYMMDD-HHmm')}.${kind}`,
                content,
                kind
            })
            if (!result.canceled) {
                setMessage({ type: 'success', text: `已导出：${result.filePath}` })
            }
        } catch (err) {
            setMessage({
                type: 'error',
                text: `导出失败：${err instanceof Error ? err.message : String(err)}`
            })
        } finally {
            setBusy(false)
        }
    }

    const doImport = async (): Promise<void> => {
        setBusy(true)
        setMessage(null)
        try {
            const filePath = await window.electronAPI.export.selectFile()
            if (!filePath) return
            const count = filePath.toLowerCase().endsWith('.json')
                ? await window.electronAPI.export.importJson(filePath)
                : await window.electronAPI.export.importIcs(filePath)
            setMessage({ type: 'success', text: `已从 ${filePath} 导入 ${count} 条日程` })
        } catch (err) {
            setMessage({
                type: 'error',
                text: `导入失败：${err instanceof Error ? err.message : String(err)}`
            })
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="ui-page-header">
                <button
                    onClick={onBack}
                    className="ui-icon-button"
                >
                    ←
                </button>
                <div>
                    <h2 className="ui-page-title">导入 / 导出</h2>
                    <p className="ui-page-description">迁移、备份或恢复你的全部日程数据</p>
                </div>
            </div>

            <div className="ui-page-content space-y-6">
                {message && (
                    <div
                        className={`px-4 py-3 rounded-xl text-sm
                            ${message.type === 'success'
                                ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                                : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* 导出 */}
                <section className="space-y-3">
                    <h3 className="ui-section-title">导出</h3>
                    <div className="ui-card p-5 space-y-3">
                        <p className="text-xs text-gray-500">导出全部日程（唯一日历）：</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => doExport('ics')}
                                disabled={busy}
                                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600
                                 disabled:opacity-50 transition-colors"
                            >
                                导出 iCalendar (.ics)
                            </button>
                            <button
                                onClick={() => doExport('json')}
                                disabled={busy}
                                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                                 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                                导出 JSON (.json)
                            </button>
                        </div>
                    </div>
                </section>

                {/* 导入 */}
                <section className="space-y-3">
                    <h3 className="ui-section-title">导入</h3>
                    <div className="ui-card p-5 space-y-2">
                        <button
                            onClick={doImport}
                            disabled={busy}
                            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600
                             disabled:opacity-50 transition-colors"
                        >
                            导入日程 (.ics / .json)
                        </button>
                        <p className="text-xs text-gray-400">
                            支持从 .ics / .json 文件导入日程，导入后可在日历中查看和编辑。
                        </p>
                    </div>
                </section>
            </div>
        </div>
    )
}
