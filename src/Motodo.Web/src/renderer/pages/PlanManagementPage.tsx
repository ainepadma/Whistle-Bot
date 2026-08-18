import { useEffect } from 'react'
import dayjs from 'dayjs'
import { useEventStore } from '@/stores/event.store'
import { useEventUiStore } from '@/stores/event-ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatClock } from '@/utils/format'

interface Props {
    onBack: () => void
}

export default function PlanManagementPage({ onBack }: Props): JSX.Element {
    const { events, loading, loadEvents } = useEventStore()
    const openDetail = useEventUiStore((s) => s.openDetail)
    const openCreate = useEventUiStore((s) => s.openCreate)
    const timeFormat = useSettingsStore((s) => s.timeFormat)

    useEffect(() => {
        loadEvents({
            start: '2000-01-01T00:00:00.000Z',
            end: '2100-01-01T00:00:00.000Z',
            item_type: 'plan',
            expand: false
        })
    }, [loadEvents])

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
                    <h2 className="ui-page-title">计划管理</h2>
                    <p className="ui-page-description">查看和维护长期安排</p>
                </div>
                <div className="flex-1" />
                <button
                    onClick={() => openCreate('plan')}
                    className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                    新建计划
                </button>
            </div>

            <div className="ui-page-content space-y-3">
                {events.length === 0 && !loading && (
                    <p className="ui-empty">暂无计划，点击右上角新建</p>
                )}
                {events.map((e) => (
                    <div
                        key={e.id}
                        className="ui-card flex items-start justify-between p-4"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium truncate">{e.title}</h3>
                                {e.rrule_str && (
                                    <span className="px-1.5 py-0.5 text-[10px] rounded
                                        bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300">
                                        重复
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {e.is_all_day
                                    ? `${dayjs(e.start_at).format('YYYY年M月D日')} 全天`
                                    : `${dayjs(e.start_at).format('YYYY年M月D日')} ${formatClock(dayjs(e.start_at), timeFormat)} - ${formatClock(dayjs(e.end_at), timeFormat)}`}
                                {e.location ? ` · ${e.location}` : ''}
                            </p>
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
