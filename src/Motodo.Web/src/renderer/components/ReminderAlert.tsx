import { useReminder } from '@/hooks/useReminder'
import Modal from './ui/Modal'

export default function ReminderAlert(): JSX.Element {
    const { reminders, showAlert, dismiss, snooze, setShowAlert } = useReminder()

    if (!showAlert || reminders.length === 0) return <></>

    const reminder = reminders[0]

    return (
        <Modal onClose={() => setShowAlert(false)} title="⏰ 日程提醒">
            <div className="space-y-4">
                <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {reminder.event?.title || '日程提醒'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        {reminder.event?.start_at || ''}
                    </p>
                </div>

                <div className="flex justify-center gap-3">
                    <button
                        onClick={() => snooze(reminder.id, 5)}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        5 分钟后提醒
                    </button>
                    <button
                        onClick={() => dismiss(reminder.id)}
                        className="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white
                       hover:bg-primary-600 transition-colors"
                    >
                        知道了
                    </button>
                </div>
            </div>
        </Modal>
    )
}
