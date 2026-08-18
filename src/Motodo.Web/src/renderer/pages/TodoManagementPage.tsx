import { useEffect } from 'react'
import dayjs from 'dayjs'
import type { Event } from '@shared/types/event'
import { useEventStore } from '@/stores/event.store'
import { useEventUiStore } from '@/stores/event-ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'

interface Props {
    onBack: () => void
}

export default function TodoManagementPage({ onBack }: Props): JSX.Element {
    const { events, loading, loadEvents, updateEvent } = useEventStore()
    const openDetail = useEventUiStore((s) => s.openDetail)
    const openCreate = useEventUiStore((s) => s.openCreate)
    const timeFormat = useSettingsStore((s) => s.timeFormat)

    useEffect(() => {
        loadEvents({
            start: '2000-01-01T00:00:00.000Z',
            end: '2100-01-01T00:00:00.000Z',
            item_type: 'todo',
            expand: false
        })
    }, [loadEvents])

    const toggleComplete = async (e: Event): Promise<void> => {
        await updateEvent(e.id, { is_completed: !e.is_completed })
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
                    <h2 className="ui-page-title">待办管理</h2>
                    <p className="ui-page-description">集中处理需要完成的事项</p>
                </div>
                <div className="flex-1" />
                <button
                    onClick={() => openCreate('todo')}
                    className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                    新建待办
                </button>
            </div>

            <div className="ui-page-content space-y-3">
                {events.length === 0 && !loading && (
                    <p className="ui-empty">暂无待办，点击右上角新建</p>
                )}
                {events.map((e) => (
                    <div
                        key={e.id}
                        className="ui-card flex items-center justify-between p-4"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={() => toggleComplete(e)}
                                className={`w-5 h-5 rounded border flex items-center justify-center text-xs flex-shrink-0
                                    ${e.is_completed
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                {e.is_completed ? '✓' : ''}
                            </button>
                            <div className="min-w-0">
                                <h3 className={`font-medium truncate ${e.is_completed ? 'line-through text-gray-400' : ''}`}>
                                    {e.title}
                                </h3>
                                <p className={`text-xs mt-0.5 ${e.is_completed ? 'text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    截止：{e.is_all_day
                                        ? dayjs(e.start_at).format('YYYY年M月D日')
                                        : `${dayjs(e.start_at).format('YYYY年M月D日')} ${formatClock(dayjs(e.start_at), timeFormat)}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => openDetail(e)}
                            className="ml-3 flex-shrink-0 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600
                             rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            详情 / 编辑
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
