using System.Text.Json;

namespace PetApp;

/// <summary>A pomodoro focus timer driven by wall-clock time, so the countdown
/// keeps running even when the overlay or the pet window is closed. State is
/// persisted locally and restored on the next launch.</summary>
public sealed class FocusTimerService : IDisposable
{
    private readonly object _gate = new();
    private readonly string _path;
    private readonly Func<DateTime> _clock;
    private readonly System.Threading.Timer _timer;
    private FocusState _state = new();
    private int _customFocusMinutes = 45;
    private int _customBreakMinutes = 5;
    private int _customLongBreakMinutes = 15;
    private int _customRounds = 6;
    private DateTime? _endUtc;
    private string? _activeEventId;
    private FocusFinishedEventArgs? _pendingRecovery;
    private bool _disposed;

    /// <summary>Raised on every state change and once per second while ticking.</summary>
    public event EventHandler? StateChanged;

    /// <summary>Raised when a focus/break phase completes (including recovery
    /// after the app was closed while a phase expired).</summary>
    public event EventHandler<FocusFinishedEventArgs>? PhaseFinished;

    public FocusTimerService(string? path = null, Func<DateTime>? clock = null)
    {
        _path = path ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BanyaoPet", "focus.json");
        _clock = clock ?? (() => DateTime.UtcNow);
        _timer = new System.Threading.Timer(_ => Refresh(), null, Timeout.Infinite, Timeout.Infinite);
        Load();
        RecoverIfExpired();
    }

    /// <summary>Starts the one-second ticker. The wall clock keeps counting
    /// independently of the ticker, which only detects phase boundaries.
    /// Recovery events that happened during construction are delivered here,
    /// after the host has had a chance to subscribe.</summary>
    public void Start()
    {
        FocusFinishedEventArgs? pending;
        lock (_gate)
        {
            pending = _pendingRecovery;
            _pendingRecovery = null;
        }
        if (pending != null) RaisePhaseFinished(pending);
        _timer.Change(0, 1000);
    }

    /// <summary>Returns a snapshot of the current state.</summary>
    public FocusState GetState()
    {
        lock (_gate)
        {
            if (_state.Status == "running" && _endUtc.HasValue)
                _state.RemainingSeconds = Math.Max(0, (int)Math.Ceiling((_endUtc.Value - _clock()).TotalSeconds));
            _state.CustomMinutes = _customFocusMinutes;
            _state.CustomBreakMinutes = _customBreakMinutes;
            _state.CustomLongBreakMinutes = _customLongBreakMinutes;
            _state.CustomRounds = _customRounds;
            _state.ActiveEventId = _activeEventId;
            return _state.Clone();
        }
    }

    /// <summary>Start from idle, pause while running, resume while paused.</summary>
    public void Toggle()
    {
        lock (_gate)
        {
            switch (_state.Status)
            {
                case "idle":
                    BeginPhaseLocked("focus");
                    break;
                case "running":
                    _state.RemainingSeconds = RemainingLocked();
                    _state.Status = "paused";
                    _endUtc = null;
                    break;
                case "paused":
                    _state.Status = "running";
                    _endUtc = _clock().AddSeconds(_state.RemainingSeconds);
                    break;
            }
            Save();
        }
        RaiseStateChanged();
    }

    /// <summary>Starts a new focus round associated with an optional schedule item.</summary>
    public void StartForEvent(string? eventId)
    {
        lock (_gate)
        {
            if (_state.Status == "running") return;
            ResetToIdleLocked();
            _activeEventId = string.IsNullOrWhiteSpace(eventId) ? null : eventId;
            BeginPhaseLocked("focus");
            Save();
        }
        RaiseStateChanged();
    }

    public void DetachEvent()
    {
        lock (_gate)
        {
            _activeEventId = null;
            Save();
        }
        RaiseStateChanged();
    }

    /// <summary>Resets the current phase to its full duration and pauses.</summary>
    public void Reset()
    {
        lock (_gate)
        {
            if (_state.Mode == "idle") return;
            var preset = CurrentPreset();
            _state.TotalSeconds = preset.TotalSeconds(_state.Mode);
            _state.RemainingSeconds = _state.TotalSeconds;
            _state.Status = "paused";
            _endUtc = null;
            Save();
        }
        RaiseStateChanged();
    }

    /// <summary>Completes the current phase immediately (focus → break, break → idle).</summary>
    public void Skip()
    {
        FocusFinishedEventArgs? finished = null;
        lock (_gate)
        {
            if (_state.Mode == "idle" || _state.Status == "idle") return;
            finished = AdvanceLocked(skipped: true);
            Save();
        }
        if (finished != null) RaisePhaseFinished(finished);
        RaiseStateChanged();
    }

    /// <summary>Switches preset. Only allowed while not running; clears the round.</summary>
    public void SetPreset(string presetId)
    {
        lock (_gate)
        {
            var isCustom = string.Equals(presetId, FocusPreset.CustomId, StringComparison.OrdinalIgnoreCase);
            if (!isCustom && FocusPreset.Find(presetId) == null) return;
            if (_state.Status == "running") return;
            var activeEventId = _activeEventId;
            _state.PresetId = isCustom ? FocusPreset.CustomId : presetId;
            ResetToIdleLocked();
            _activeEventId = activeEventId;
            Save();
        }
        RaiseStateChanged();
    }

    /// <summary>Sets the full custom config (focus / short break / long break
    /// minutes and rounds before the long break) and switches to the custom
    /// preset. Only allowed while not running; clears the round like any
    /// preset switch.</summary>
    public void SetCustom(int focusMinutes, int breakMinutes, int longBreakMinutes, int rounds)
    {
        lock (_gate)
        {
            if (_state.Status == "running") return;
            _customFocusMinutes = Math.Clamp(focusMinutes, 1, 180);
            _customBreakMinutes = Math.Clamp(breakMinutes, 1, 120);
            _customLongBreakMinutes = Math.Clamp(longBreakMinutes, 1, 240);
            _customRounds = Math.Clamp(rounds, 1, 8);
            var activeEventId = _activeEventId;
            _state.PresetId = FocusPreset.CustomId;
            ResetToIdleLocked();
            _activeEventId = activeEventId;
            Save();
        }
        RaiseStateChanged();
    }

    /// <summary>Advances expired phases and raises events. Used by the ticker
    /// and by tests that drive a fake clock.</summary>
    public void Refresh()
    {
        FocusFinishedEventArgs? finished = null;
        lock (_gate)
        {
            if (_disposed) return;
            if (_state.Status == "running" && _endUtc.HasValue && _endUtc.Value <= _clock())
            {
                finished = AdvanceLocked();
                Save();
            }
        }
        if (finished != null) RaisePhaseFinished(finished);
        RaiseStateChanged();
    }

    public void Dispose()
    {
        lock (_gate) _disposed = true;
        _timer.Dispose();
    }

    private void BeginPhaseLocked(string mode)
    {
        var preset = CurrentPreset();
        _state.Mode = mode;
        _state.Status = "running";
        _state.TotalSeconds = preset.TotalSeconds(mode);
        _state.RemainingSeconds = _state.TotalSeconds;
        _endUtc = _clock().AddSeconds(_state.TotalSeconds);
    }

    private void ResetToIdleLocked()
    {
        _state.Mode = "idle";
        _state.Status = "idle";
        _state.CycleIndex = 0;
        var preset = CurrentPreset();
        _state.TotalSeconds = preset.FocusSeconds;
        _state.RemainingSeconds = _state.TotalSeconds;
        _endUtc = null;
        _activeEventId = null;
    }

    private FocusFinishedEventArgs AdvanceLocked(bool skipped = false)
    {
        var completed = _state.Mode;
        var completedEventId = completed == "focus" ? _activeEventId : null;
        var completedSeconds = completed == "focus" ? _state.TotalSeconds : 0;
        var actualSeconds = completed == "focus"
            ? Math.Clamp(_state.TotalSeconds - RemainingLocked(), 0, _state.TotalSeconds)
            : 0;
        var preset = CurrentPreset();
        if (completed == "focus")
        {
            var rounds = CurrentRounds();
            _state.CycleIndex = Math.Min(rounds, _state.CycleIndex + 1);
            var next = _state.CycleIndex >= rounds ? "long-break" : "short-break";
            _state.Mode = next;
            _state.TotalSeconds = preset.TotalSeconds(next);
            _state.RemainingSeconds = _state.TotalSeconds;
            _state.Status = "running";
            _endUtc = _clock().AddSeconds(_state.TotalSeconds);
                        return new FocusFinishedEventArgs(completed, next, false, completedEventId, completedSeconds, actualSeconds, skipped);
        }
        if (completed == "long-break") _state.CycleIndex = 0;
        BeginPhaseLocked("focus");
        return new FocusFinishedEventArgs(completed, "focus", false, completedEventId, completedSeconds, actualSeconds, skipped);
    }

    private int RemainingLocked() => _state.Status == "running" && _endUtc.HasValue
        ? Math.Max(0, (int)Math.Ceiling((_endUtc.Value - _clock()).TotalSeconds))
        : _state.RemainingSeconds;

    private FocusPreset CurrentPreset() =>
        string.Equals(_state.PresetId, FocusPreset.CustomId, StringComparison.OrdinalIgnoreCase)
            ? FocusPreset.Custom(_customFocusMinutes, _customBreakMinutes, _customLongBreakMinutes)
            : FocusPreset.Find(_state.PresetId) ?? FocusPreset.All[0];

    private int CurrentRounds() =>
        string.Equals(_state.PresetId, FocusPreset.CustomId, StringComparison.OrdinalIgnoreCase)
            ? _customRounds
            : 4;

    private void Load()
    {
        try
        {
            if (!File.Exists(_path)) return;
            var p = JsonSerializer.Deserialize<FocusPersist>(File.ReadAllText(_path));
            if (p == null) return;
            var isCustom = string.Equals(p.PresetId, FocusPreset.CustomId, StringComparison.OrdinalIgnoreCase);
            if (!isCustom && FocusPreset.Find(p.PresetId) == null) return;
            _state.PresetId = p.PresetId;
            _customFocusMinutes = Math.Clamp(p.CustomMinutes, 1, 180);
            _customBreakMinutes = Math.Clamp(p.CustomBreakMinutes, 1, 120);
            _customLongBreakMinutes = Math.Clamp(p.CustomLongBreakMinutes, 1, 240);
            _customRounds = Math.Clamp(p.CustomRounds, 1, 8);
            _state.Mode = ValidMode(p.Mode);
            _state.Status = ValidStatus(p.Status);
            if (_state.Mode == "idle" && _state.Status != "idle") _state.Status = "idle";
            _state.CycleIndex = Math.Clamp(p.CycleIndex, 0, 4);
            _state.TotalSeconds = p.TotalSeconds > 0 ? p.TotalSeconds : CurrentPreset().FocusSeconds;
            _state.RemainingSeconds = Math.Max(0, p.RemainingSeconds);
            _endUtc = p.EndTimeUtc;
            _activeEventId = p.ActiveEventId;
            if (_state.Status == "running")
            {
                if (_endUtc.HasValue)
                    _state.RemainingSeconds = Math.Max(0, (int)Math.Ceiling((_endUtc.Value - _clock()).TotalSeconds));
                else
                {
                    _state.Status = "paused";
                    _endUtc = null;
                }
            }
            else if (_state.Status == "idle")
            {
                _endUtc = null;
                _state.TotalSeconds = CurrentPreset().FocusSeconds;
                _state.RemainingSeconds = _state.TotalSeconds;
            }
            else
            {
                _endUtc = null;
            }
        }
        catch
        {
            _state = new FocusState();
        }
    }

    private void RecoverIfExpired()
    {
        lock (_gate)
        {
            var now = _clock();
            if (_state.Status != "running" || !_endUtc.HasValue || _endUtc.Value > now) return;
            var completed = _state.Mode;
            FocusFinishedEventArgs? recoveredFocus = null;
            var guard = 0;
            while (_state.Status == "running" && _endUtc.HasValue && _endUtc.Value <= now && guard++ < 8)
            {
                var advanced = AdvanceLocked();
                if (advanced.CompletedPhase == "focus" && recoveredFocus == null) recoveredFocus = advanced;
            }
            if (_state.Status == "running")
            {
                _state.Status = "paused";
                _state.RemainingSeconds = RemainingLocked();
                _endUtc = null;
            }
            Save();
            _pendingRecovery = recoveredFocus == null
                ? new FocusFinishedEventArgs(completed, _state.Mode, true)
                : new FocusFinishedEventArgs(recoveredFocus.CompletedPhase, recoveredFocus.NextPhase, true,
                    recoveredFocus.EventId, recoveredFocus.PlannedSeconds, recoveredFocus.ActualSeconds);
        }
    }

    private void Save()
    {
        try
        {
            var dir = Path.GetDirectoryName(_path);
            if (string.IsNullOrEmpty(dir)) return;
            Directory.CreateDirectory(dir);
            var p = new FocusPersist
            {
                PresetId = _state.PresetId,
                CustomMinutes = _customFocusMinutes,
                CustomBreakMinutes = _customBreakMinutes,
                CustomLongBreakMinutes = _customLongBreakMinutes,
                CustomRounds = _customRounds,
                Mode = _state.Mode,
                Status = _state.Status,
                CycleIndex = _state.CycleIndex,
                TotalSeconds = _state.TotalSeconds,
                RemainingSeconds = _state.Status == "running" ? RemainingLocked() : _state.RemainingSeconds,
                EndTimeUtc = _state.Status == "running" ? _endUtc : null,
                ActiveEventId = _activeEventId
            };
            File.WriteAllText(_path, JsonSerializer.Serialize(p));
        }
        catch
        {
        }
    }

    private static string ValidMode(string mode) =>
        mode is "focus" or "short-break" or "long-break" ? mode : "idle";

    private static string ValidStatus(string status) =>
        status is "running" or "paused" ? status : "idle";

    private void RaiseStateChanged() => StateChanged?.Invoke(this, EventArgs.Empty);

    private void RaisePhaseFinished(FocusFinishedEventArgs e) => PhaseFinished?.Invoke(this, e);
}

/// <summary>Immutable snapshot of the current timer state. The string values of
/// <see cref="Mode"/> and <see cref="Status"/> match the host ↔ UI protocol.</summary>
public sealed class FocusState
{
    public string Mode { get; set; } = "idle";        // idle|focus|short-break|long-break
    public string Status { get; set; } = "idle";      // idle|running|paused
    public int RemainingSeconds { get; set; } = 1500;
    public int TotalSeconds { get; set; } = 1500;
    public string PresetId { get; set; } = "25-5";
    public int CycleIndex { get; set; }               // completed focus rounds, 0..4
    public int CustomMinutes { get; set; } = 45;      // active value of the custom preset
    public int CustomBreakMinutes { get; set; } = 5;
    public int CustomLongBreakMinutes { get; set; } = 15;
    public int CustomRounds { get; set; } = 6;
    public string? ActiveEventId { get; set; }

    public string Label => Mode switch
    {
        "focus" => Status == "paused" ? "专注 · 已暂停" : "专注中",
        "short-break" => Status == "paused" ? "短休息 · 已暂停" : "短休息",
        "long-break" => Status == "paused" ? "长休息 · 已暂停" : "长休息",
        _ => "准备专注"
    };

    public FocusState Clone() => new()
    {
        Mode = Mode,
        Status = Status,
        RemainingSeconds = RemainingSeconds,
        TotalSeconds = TotalSeconds,
        PresetId = PresetId,
        CycleIndex = CycleIndex,
        CustomMinutes = CustomMinutes,
        CustomBreakMinutes = CustomBreakMinutes,
        CustomLongBreakMinutes = CustomLongBreakMinutes,
        CustomRounds = CustomRounds,
        ActiveEventId = ActiveEventId
    };
}

/// <summary>A pomodoro preset: focus / short break / long break lengths.</summary>
public sealed class FocusPreset
{
    public const string CustomId = "custom";

    public static readonly FocusPreset[] All =
    {
        new("25-5", "25 / 5", 25, 5, 15),
        new("45-10", "45 / 10", 45, 10, 20),
        new("60-15", "60 / 15", 60, 15, 30),
    };

    private FocusPreset(string id, string label, int focusMinutes, int shortBreakMinutes, int longBreakMinutes)
    {
        Id = id;
        Label = label;
        FocusSeconds = focusMinutes * 60;
        ShortBreakSeconds = shortBreakMinutes * 60;
        LongBreakSeconds = longBreakMinutes * 60;
    }

    public string Id { get; }
    public string Label { get; }
    public int FocusSeconds { get; }
    public int ShortBreakSeconds { get; }
    public int LongBreakSeconds { get; }

    public int TotalSeconds(string mode) => mode switch
    {
        "focus" => FocusSeconds,
        "short-break" => ShortBreakSeconds,
        "long-break" => LongBreakSeconds,
        _ => FocusSeconds
    };

    public static FocusPreset? Find(string id) =>
        All.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));

    /// <summary>Custom preset with user-defined focus/break lengths.</summary>
    public static FocusPreset Custom(int focusMinutes, int breakMinutes, int longBreakMinutes) =>
        new(CustomId, $"{focusMinutes} 分钟", focusMinutes, breakMinutes, longBreakMinutes);
}

public sealed class FocusFinishedEventArgs : EventArgs
{
    public FocusFinishedEventArgs(string completedPhase, string nextPhase, bool recovered, string? eventId = null,
        int plannedSeconds = 0, int actualSeconds = 0, bool skipped = false)
    {
        CompletedPhase = completedPhase;
        NextPhase = nextPhase;
        Recovered = recovered;
        EventId = eventId;
        PlannedSeconds = plannedSeconds;
        ActualSeconds = actualSeconds;
        Skipped = skipped;
    }

    /// <summary>Phase that just completed: focus | short-break | long-break.</summary>
    public string CompletedPhase { get; }

    /// <summary>Phase the timer moved to: short-break | long-break | idle.</summary>
    public string NextPhase { get; }

    /// <summary>True when the phase expired while the app was closed.</summary>
    public bool Recovered { get; }
    public string? EventId { get; }
    public int PlannedSeconds { get; }
    public int ActualSeconds { get; }
    public bool Skipped { get; }
}

/// <summary>Persisted layout, mirrored 1:1 to focus.json.</summary>
internal sealed class FocusPersist
{
    public int Version { get; set; } = 1;
    public string PresetId { get; set; } = "25-5";
    public int CustomMinutes { get; set; } = 45;
    public int CustomBreakMinutes { get; set; } = 5;
    public int CustomLongBreakMinutes { get; set; } = 15;
    public int CustomRounds { get; set; } = 6;
    public string Mode { get; set; } = "idle";
    public string Status { get; set; } = "idle";
    public int CycleIndex { get; set; }
    public int TotalSeconds { get; set; } = 1500;
    public int RemainingSeconds { get; set; } = 1500;
    public DateTime? EndTimeUtc { get; set; }
    public string? ActiveEventId { get; set; }
}
