using Microsoft.Win32;
using PetApp.Schedule;

namespace PetApp.DesktopCards;

/// <summary>Owns detachable card windows and their durable desktop layout.</summary>
internal sealed class CardHostManager : IDisposable
{
    private readonly ScheduleStore _store;
    private readonly IScheduleDesktopHost _desktop;
    private readonly CardLayoutStore _layouts = new();
    private readonly Dictionary<string, CardForm> _forms = new(StringComparer.OrdinalIgnoreCase);
    private readonly CardWindowState _state = new();
    private readonly SynchronizationContext? _uiContext;
    private readonly Dictionary<string, PendingSwitch> _pendingSwitches = new();
    private readonly Dictionary<string, int> _contentHeights = new(StringComparer.OrdinalIgnoreCase);
    private bool _restoring;
    private bool _applyingBounds;
    private bool _disposed;

    private sealed record PendingSwitch(string Target, CardForm Form, EventHandler Handler, bool TargetWasVisible);

    public CardHostManager(ScheduleStore store, IScheduleDesktopHost desktop)
    {
        _store = store;
        _desktop = desktop;
        _uiContext = SynchronizationContext.Current;
        SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
    }

    public void RestorePinnedCards()
    {
        _restoring = true;
        try
        {
            foreach (var layout in _layouts.PinnedCards()) Show(layout.Kind, activate: false);
        }
        finally
        {
            _restoring = false;
        }
    }

    public void Show(string kind, bool activate = true)
    {
        kind = Normalize(kind);
        CancelPendingSwitches(kind);
        var layout = _layouts.Get(kind);
        var form = GetOrCreate(kind, layout);
        Apply(form, layout);
        layout.Visible = true;
        _state.Request(kind, true);
        _layouts.Save(layout);
        form.Reveal(activate);

        PublishState(kind);
    }

    /// <summary>Switches an unpinned card in place; pinned cards remain and add the target card.</summary>
    public void Switch(string fromKind, string toKind)
    {
        fromKind = Normalize(fromKind);
        toKind = Normalize(toKind);
        if (fromKind == toKind) { Show(toKind); return; }
        if (!IsVisible(fromKind)) { Show(toKind); return; }

        var sourceLayout = _layouts.Get(fromKind);
        if (sourceLayout.Pinned) { Show(toKind); return; }

        CancelPendingSwitches(fromKind);
        CancelPendingSwitches(toKind);

        var sourceForm = _forms.TryGetValue(fromKind, out var existingSource) && existingSource.Visible ? existingSource : null;
        var location = sourceForm != null ? sourceForm.Location : new Point(sourceLayout.X, sourceLayout.Y);
        var targetLayout = _layouts.Get(toKind);
        if (targetLayout.Pinned) { Show(toKind); return; }
        var targetWasVisible = IsVisible(toKind);
        targetLayout.X = location.X;
        targetLayout.Y = location.Y;
        targetLayout.Visible = true;
        _layouts.Save(targetLayout);
        var targetForm = GetOrCreate(toKind, targetLayout);
        Apply(targetForm, targetLayout);
        var sourceRevision = _state.Request(fromKind, true);
        var targetRevision = _state.Request(toKind, true);

        void ConcealSource()
        {
            if (!_state.IsCurrent(fromKind, sourceRevision) || !_state.IsCurrent(toKind, targetRevision)) return;
            sourceLayout.Visible = false;
            _state.Request(fromKind, false);
            _layouts.Save(sourceLayout);
            sourceForm?.Conceal();
            PublishState(fromKind);
        }

        if (targetForm.IsContentReady) ConcealSource();
        else
        {
            EventHandler? revealSource = null;
            revealSource = (_, _) =>
            {
                targetForm.ContentReady -= revealSource;
                _pendingSwitches.Remove(fromKind);
                ConcealSource();
            };
            _pendingSwitches[fromKind] = new PendingSwitch(toKind, targetForm, revealSource, targetWasVisible);
            targetForm.ContentReady += revealSource;
        }
        targetForm.Reveal();
        PublishState(toKind);
    }
    public void Hide(string kind)
    {
        kind = Normalize(kind);
        CancelPendingSwitches(kind);
        Conceal(kind);
    }

    private void Conceal(string kind)
    {
        var layout = _layouts.Get(kind);
        layout.Visible = false;
        _state.Request(kind, false);
        _layouts.Save(layout);
        if (_forms.TryGetValue(kind, out var form) && form.Visible) form.Conceal();
        PublishState(kind);
    }

    public bool IsVisible(string kind) => _state.IsVisible(Normalize(kind));

    public CardPresentation Presentation(string kind)
    {
        kind = Normalize(kind);
        var layout = _layouts.Get(kind);
        return new CardPresentation(kind, IsVisible(kind), layout.Pinned, layout.AlwaysOnTop);
    }

    public void TogglePinned(string kind)
    {
        kind = Normalize(kind);
        CancelPendingSwitches(kind);
        var layout = _layouts.Get(kind);
        layout.Pinned = !layout.Pinned;
        _layouts.Save(layout);
        PublishState(kind);
    }

    public void BeginDrag(string kind)
    {
        kind = Normalize(kind);
        var layout = _layouts.Get(kind);
        if (layout.Pinned) return;
        if (_forms.TryGetValue(kind, out var form) && IsVisible(kind)) form.BeginNativeDrag();
    }
    public void Move(string kind, int deltaX, int deltaY)
    {
        kind = Normalize(kind);
        if (!_forms.TryGetValue(kind, out var form) || !IsVisible(kind)) return;
        var layout = _layouts.Get(kind);
        if (layout.Pinned) return;
        var location = new Point(form.Left + DpiLayout.ToDevice(form, deltaX), form.Top + DpiLayout.ToDevice(form, deltaY));
        Fit(form, layout, location, Screen.FromRectangle(new Rectangle(location, form.Size)));
        layout.X = form.Left;
        layout.Y = form.Top;
        _layouts.Save(layout);
    }

    public void Resize(string kind, int width, int height)
    {
        if (!TryNormalize(kind, out kind) || !CardWindowLayout.IsValidRequest(width, height)) return;
        if (!_forms.TryGetValue(kind, out var form) || !IsVisible(kind)) return;
        var logical = CardWindowLayout.ClampPreference(kind, new Size(width, height));
        var layout = _layouts.Get(kind);
        layout.Width = logical.Width;
        layout.Height = logical.Height;
        layout.ManualSize = true;
        Fit(form, layout, form.Location, Screen.FromRectangle(form.Bounds));
        layout.X = form.Left;
        layout.Y = form.Top;
        _layouts.Save(layout);
    }

    public void BeginResize(string kind, string direction)
    {
        if (!TryNormalize(kind, out kind) || CardWindowLayout.ResizeHitTest(direction) == 0) return;
        if (_forms.TryGetValue(kind, out var form) && IsVisible(kind)) form.BeginNativeResize(direction);
    }

    public void FitContent(string kind, int height)
    {
        if (!TryNormalize(kind, out kind) || height is <= 0 or > 32768) return;
        if (!_forms.TryGetValue(kind, out var form)) return;
        if (_contentHeights.TryGetValue(kind, out var previous) && previous == height) return;
        _contentHeights[kind] = height;
        if (!IsVisible(kind) || form.IsNativeResizing) return;
        Fit(form, _layouts.Get(kind), form.Location, Screen.FromRectangle(form.Bounds));
    }

    public void ResetSize(string kind)
    {
        if (!TryNormalize(kind, out kind)) return;
        var layout = _layouts.Get(kind);
        var size = CardWindowLayout.PreferredSize(kind);
        layout.Width = size.Width;
        layout.Height = size.Height;
        layout.ManualSize = false;
        _layouts.Save(layout);
        if (_forms.TryGetValue(kind, out var form))
            Fit(form, layout, form.Location, Screen.FromRectangle(form.Bounds));
    }

    public void RecordManualSize(CardForm form)
    {
        if (_restoring || _applyingBounds || !IsVisible(form.Kind)) return;
        var layout = _layouts.Get(form.Kind);
        var logical = CardWindowLayout.ClampPreference(form.Kind, DpiLayout.ToLogical(form, form.Size));
        layout.Width = logical.Width;
        layout.Height = logical.Height;
        layout.ManualSize = true;
        Fit(form, layout, form.Location, Screen.FromRectangle(form.Bounds));
        layout.X = form.Left;
        layout.Y = form.Top;
        _layouts.Save(layout);
    }

    public void RecordBounds(CardForm form)
    {
        if (_restoring || _applyingBounds || !IsVisible(form.Kind)) return;
        var layout = _layouts.Get(form.Kind);
        Fit(form, layout, form.Location, Screen.FromRectangle(form.Bounds));
        layout.X = form.Left;
        layout.Y = form.Top;
        layout.Visible = true;
        _layouts.Save(layout);
    }

    public void Dispose()
    {
        _disposed = true;
        SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged;
        foreach (var pending in _pendingSwitches.Values) pending.Form.ContentReady -= pending.Handler;
        _pendingSwitches.Clear();
        foreach (var form in _forms.Values) form.Dispose();
        _forms.Clear();
    }

    private CardForm GetOrCreate(string kind, CardLayout layout)
    {
        if (_forms.TryGetValue(kind, out var form)) return form;
        form = new CardForm(kind, _store, _desktop, this);
        _forms.Add(kind, form);
        return form;
    }

    private void Apply(CardForm form, CardLayout layout)
    {
        form.TopMost = layout.AlwaysOnTop;
        Point? location = layout.X == int.MinValue || layout.Y == int.MinValue ? null : new Point(layout.X, layout.Y);
        var screen = location.HasValue ? Screen.FromPoint(location.Value) : Screen.PrimaryScreen ?? Screen.AllScreens[0];
        Fit(form, layout, location, screen);
    }

    private void Fit(CardForm form, CardLayout layout, Point? location, Screen screen, int? dpi = null)
    {
        if (_applyingBounds || form.IsDisposed || form.IsNativeResizing) return;
        var preferred = CardWindowLayout.EffectiveSize(layout, _contentHeights.GetValueOrDefault(form.Kind));
        var bounds = CardWindowLayout.Fit(preferred,
            location, screen.WorkingArea, dpi ?? DpiLayout.ForScreen(screen, form.DeviceDpi));
        if (form.Bounds == bounds) return;
        _applyingBounds = true;
        try { form.Bounds = bounds; }
        finally { _applyingBounds = false; }
    }

    public void OnDpiChanged(CardForm form, Rectangle suggestedBounds, int dpi)
    {
        if (form.IsNativeResizing) return;
        Fit(form, _layouts.Get(form.Kind), suggestedBounds.Location, Screen.FromRectangle(suggestedBounds), dpi);
    }

    private void OnDisplaySettingsChanged(object? sender, EventArgs args)
    {
        _uiContext?.Post(_ =>
        {
            if (_disposed) return;
            foreach (var form in _forms.Values.Where(form => IsVisible(form.Kind)))
                Fit(form, _layouts.Get(form.Kind), form.Location, Screen.FromRectangle(form.Bounds));
        }, null);
    }

    private void CancelPendingSwitches(string kind)
    {
        foreach (var entry in _pendingSwitches.Where(entry => entry.Key == kind || entry.Value.Target == kind).ToArray())
        {
            _pendingSwitches.Remove(entry.Key);
            entry.Value.Form.ContentReady -= entry.Value.Handler;
            // A superseded, newly opened destination must not appear later when its page finishes loading.
            if (!entry.Value.TargetWasVisible && entry.Value.Target != kind) Conceal(entry.Value.Target);
        }
    }

    private void PublishState(string kind) => ScheduleEventHub.Instance.Publish("card:state", Presentation(kind));

    private static bool TryNormalize(string? value, out string kind)
    {
        kind = value?.Trim().ToLowerInvariant() ?? "";
        return kind is "today" or "next" or "calendar" or "manage";
    }

    private static string Normalize(string kind)
    {
        return kind.Trim().ToLowerInvariant() switch
        {
            "calendar" => "calendar",
            "manage" => "manage",
            "next" or "focus" or "todo" or "upcoming" => "next",
            _ => "today"
        };
    }
}
