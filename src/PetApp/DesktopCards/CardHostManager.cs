using PetApp.Schedule;

namespace PetApp.DesktopCards;

/// <summary>Owns detachable card windows and their durable desktop layout.</summary>
internal sealed class CardHostManager : IDisposable
{
    private readonly ScheduleStore _store;
    private readonly IScheduleDesktopHost _desktop;
    private readonly CardLayoutStore _layouts = new();
    private readonly Dictionary<string, CardForm> _forms = new(StringComparer.OrdinalIgnoreCase);
    private bool _restoring;

    public CardHostManager(ScheduleStore store, IScheduleDesktopHost desktop)
    {
        _store = store;
        _desktop = desktop;
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
        var layout = _layouts.Get(kind);
        var form = GetOrCreate(kind, layout);
        Apply(form, layout);
        layout.Visible = true;
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

        var sourceLayout = _layouts.Get(fromKind);
        if (sourceLayout.Pinned) { Show(toKind); return; }

        var sourceForm = _forms.TryGetValue(fromKind, out var existingSource) && existingSource.Visible ? existingSource : null;
        var location = sourceForm != null ? sourceForm.Location : new Point(sourceLayout.X, sourceLayout.Y);
        var targetLayout = _layouts.Get(toKind);
        if (targetLayout.Pinned) { Show(toKind); return; }
        targetLayout.X = location.X;
        targetLayout.Y = location.Y;
        targetLayout.Visible = true;
        _layouts.Save(targetLayout);
        var targetForm = GetOrCreate(toKind, targetLayout);
        Apply(targetForm, targetLayout);

        void ConcealSource()
        {
            sourceLayout.Visible = false;
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
                ConcealSource();
            };
            targetForm.ContentReady += revealSource;
        }
        targetForm.Reveal();
        PublishState(toKind);
    }
    public void Hide(string kind)
    {
        kind = Normalize(kind);
        var layout = _layouts.Get(kind);
        layout.Visible = false;
        _layouts.Save(layout);
        if (_forms.TryGetValue(kind, out var form) && form.Visible) form.Conceal();
        PublishState(kind);
    }

    public bool IsVisible(string kind) => _forms.TryGetValue(Normalize(kind), out var form) && form.Visible;

    public CardPresentation Presentation(string kind)
    {
        kind = Normalize(kind);
        var layout = _layouts.Get(kind);
        return new CardPresentation(kind, IsVisible(kind), layout.Pinned, layout.AlwaysOnTop);
    }

    public void TogglePinned(string kind)
    {
        kind = Normalize(kind);
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
        if (_forms.TryGetValue(kind, out var form) && form.Visible) form.BeginNativeDrag();
    }
    public void Move(string kind, int deltaX, int deltaY)
    {
        kind = Normalize(kind);
        if (!_forms.TryGetValue(kind, out var form) || !form.Visible) return;
        var layout = _layouts.Get(kind);
        if (layout.Pinned) return;
        var workArea = Screen.FromRectangle(form.Bounds).WorkingArea;
        var x = Math.Clamp(form.Left + DpiLayout.ToDevice(form, deltaX), workArea.Left, Math.Max(workArea.Left, workArea.Right - form.Width));
        var y = Math.Clamp(form.Top + DpiLayout.ToDevice(form, deltaY), workArea.Top, Math.Max(workArea.Top, workArea.Bottom - form.Height));
        form.Location = new Point(x, y);
        layout.X = form.Left;
        layout.Y = form.Top;
        _layouts.Save(layout);
    }

    public void Resize(string kind, int width, int height)
    {
        kind = Normalize(kind);
        if (!_forms.TryGetValue(kind, out var form) || !form.Visible) return;

        var logical = ClampLogical(kind, new Size(width, height));
        var workArea = Screen.FromRectangle(form.Bounds).WorkingArea;
        // Never grow past the usable monitor area. The React modal then falls
        // back to its hidden-scroll viewport on very small displays.
        var available = DpiLayout.ToLogical(form, new Size(
            Math.Max(form.MinimumSize.Width, workArea.Width - 32),
            Math.Max(form.MinimumSize.Height, workArea.Height - 32)));
        logical = new Size(Math.Min(logical.Width, available.Width), Math.Min(logical.Height, available.Height));

        var next = DpiLayout.ToDevice(form, logical);
        if (form.Size == next) return;
        form.Size = next;
        form.Location = new Point(
            Math.Clamp(form.Left, workArea.Left, Math.Max(workArea.Left, workArea.Right - form.Width)),
            Math.Clamp(form.Top, workArea.Top, Math.Max(workArea.Top, workArea.Bottom - form.Height)));
        var layout = _layouts.Get(kind);
        layout.Width = logical.Width;
        layout.Height = logical.Height;
        layout.X = form.Left;
        layout.Y = form.Top;
        _layouts.Save(layout);
    }
    public void RecordBounds(CardForm form)
    {
        if (_restoring || !form.Visible) return;
        var layout = _layouts.Get(form.Kind);
        layout.X = form.Left;
        layout.Y = form.Top;
        var logical = DpiLayout.ToLogical(form, form.Size);
        layout.Width = logical.Width;
        layout.Height = logical.Height;
        layout.Visible = true;
        _layouts.Save(layout);
    }

    public void Dispose()
    {
        foreach (var form in _forms.Values) form.Dispose();
        _forms.Clear();
    }

    private CardForm GetOrCreate(string kind, CardLayout layout)
    {
        if (_forms.TryGetValue(kind, out var form)) return form;
        form = new CardForm(kind, _store, _desktop, this);
        _forms.Add(kind, form);
        Apply(form, layout);
        return form;
    }

    private static void Apply(CardForm form, CardLayout layout)
    {
        var logical = ClampLogical(form.Kind, new Size(layout.Width, layout.Height));
        // Before the first handle is created WinForms performs the initial DPI
        // autoscale itself. Subsequent shows must convert the persisted CSS size.
        form.Size = form.IsHandleCreated ? DpiLayout.ToDevice(form, logical) : logical;
        form.TopMost = layout.AlwaysOnTop;
        var workArea = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 720);
        var x = layout.X == int.MinValue ? workArea.Right - form.Width - 28 : layout.X;
        var y = layout.Y == int.MinValue ? workArea.Bottom - form.Height - 96 : layout.Y;
        form.Location = new Point(
            Math.Clamp(x, workArea.Left, Math.Max(workArea.Left, workArea.Right - form.Width)),
            Math.Clamp(y, workArea.Top, Math.Max(workArea.Top, workArea.Bottom - form.Height)));
    }

    private static Size ClampLogical(string kind, Size size) => kind switch
    {
        "calendar" => new Size(Math.Clamp(size.Width, 760, 1360), Math.Clamp(size.Height, 520, 960)),
        "next" => new Size(Math.Clamp(size.Width, 340, 720), Math.Clamp(size.Height, 280, 920)),
        "manage" => new Size(Math.Clamp(size.Width, 560, 1100), Math.Clamp(size.Height, 480, 920)),
        _ => new Size(Math.Clamp(size.Width, 340, 720), Math.Clamp(size.Height, 260, 920))
    };

    private void PublishState(string kind) => ScheduleEventHub.Instance.Publish("card:state", Presentation(kind));

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
