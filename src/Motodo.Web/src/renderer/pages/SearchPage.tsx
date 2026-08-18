import { useState, useCallback } from 'react'
import type { Event } from '@shared/types/event'
import { useEventUiStore } from '@/stores/event-ui.store'

interface SearchPageProps {
    onBack: () => void
}

export default function SearchPage({ onBack }: SearchPageProps): JSX.Element {
    const [keyword, setKeyword] = useState('')
    const [results, setResults] = useState<Event[]>([])
    const [loading, setLoading] = useState(false)
    const openDetail = useEventUiStore((s) => s.openDetail)

    const handleSearch = useCallback(async () => {
        if (!keyword.trim()) return
        setLoading(true)
        try {
            const events = await window.electronAPI.event.search(keyword.trim())
            setResults(events)
        } catch {
            setResults([])
        } finally {
            setLoading(false)
        }
    }, [keyword])

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
                    <h2 className="ui-page-title">搜索日程</h2>
                    <p className="ui-page-description">按标题、地点或描述快速查找</p>
                </div>
            </div>

            <div className="ui-page-content">
                {/* 搜索栏 */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="输入关键词搜索..."
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2
                       focus:ring-primary-500/30 transition-all"
                        autoFocus
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-5 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium
                       hover:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                        {loading ? '搜索中...' : '搜索'}
                    </button>
                </div>

                {/* 搜索结果 */}
                <div className="mt-6 space-y-3">
                    {results.length === 0 && keyword && !loading && (
                        <p className="ui-empty">
                            未找到 "{keyword}" 相关的日程
                        </p>
                    )}

                    {results.map(event => (
                        <div
                            key={event.id}
                            onClick={() => openDetail(event)}
                            className="ui-card cursor-pointer p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                        {event.title}
                                    </h3>
                                    {event.description && (
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                        <span>{event.start_at}</span>
                                        {event.location && <span>📍 {event.location}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {!keyword && (
                        <p className="ui-empty">
                            输入关键词搜索日程标题、描述或地点
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
