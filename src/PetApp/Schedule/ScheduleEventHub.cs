namespace PetApp.Schedule;

/// <summary>In-process event fan-out shared by the planner and all desktop cards.</summary>
internal sealed class ScheduleEventHub
{
    public static ScheduleEventHub Instance { get; } = new();

    private event Action<string, object?>? Published;

    public IDisposable Subscribe(Action<string, object?> handler)
    {
        Published += handler;
        return new Subscription(this, handler);
    }

    public void Publish(string channel, object? payload = null) => Published?.Invoke(channel, payload);

    private sealed class Subscription : IDisposable
    {
        private ScheduleEventHub? _owner;
        private readonly Action<string, object?> _handler;

        public Subscription(ScheduleEventHub owner, Action<string, object?> handler)
        {
            _owner = owner;
            _handler = handler;
        }

        public void Dispose()
        {
            if (_owner is not { } owner) return;
            owner.Published -= _handler;
            _owner = null;
        }
    }
}
