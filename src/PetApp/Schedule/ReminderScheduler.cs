using System.Threading;

namespace PetApp.Schedule;

/// <summary>Polls durable reminders independently of the planner window lifecycle.</summary>
internal sealed class ReminderScheduler : IDisposable
{
    private readonly ScheduleStore _store;
    private System.Threading.Timer? _timer;
    private int _checking;
    private DateTimeOffset _nextHorizonRefresh = DateTimeOffset.MinValue;

    public ReminderScheduler(ScheduleStore store) => _store = store;

    public event Action<int>? RemindersDue;

    public void Start() => _timer = new System.Threading.Timer(_ => Check(), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30));

    private void Check()
    {
        if (Interlocked.Exchange(ref _checking, 1) != 0) return;
        try
        {
            var now = DateTimeOffset.UtcNow;
            if (now >= _nextHorizonRefresh)
            {
                _store.EnsureRecurringReminderHorizon();
                _nextHorizonRefresh = now.AddHours(1);
            }
            var due = _store.ClaimDueReminders();
            if (due.Count > 0) RemindersDue?.Invoke(due.Count);
        }
        catch
        {
            // A later interval retries transient database or shutdown failures.
        }
        finally
        {
            Volatile.Write(ref _checking, 0);
        }
    }

    public void Dispose() => _timer?.Dispose();
}

