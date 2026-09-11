namespace PetApp.DesktopCards;

/// <summary>Fits a preferred CSS size without replacing it with a temporary monitor limit.</summary>
internal static class CardWindowLayout
{
    // CSS pixels. Compact cards start square; content growth never overwrites this baseline.
    public static Size PreferredSize(string kind) => kind switch
    {
        "calendar" => new Size(940, 660),
        "manage" => new Size(720, 380),
        _ => new Size(320, 320)
    };

    public static Size MinimumSize(string kind) => kind switch
    {
        "calendar" => new Size(600, 420),
        "manage" => new Size(480, 320),
        _ => new Size(300, 260)
    };

    public static bool IsValidRequest(int width, int height) =>
        width is > 0 and <= 32768 && height is > 0 and <= 32768;

    public static Size ClampPreference(string kind, Size preferred)
    {
        var minimum = MinimumSize(kind);
        return new Size(Math.Clamp(preferred.Width, minimum.Width, 32768),
            Math.Clamp(preferred.Height, minimum.Height, 32768));
    }

    public static Size EffectiveSize(CardLayout layout, int contentHeight)
    {
        var baseline = ClampPreference(layout.Kind, new Size(layout.Width, layout.Height));
        return layout.ManualSize ? baseline : new Size(baseline.Width,
            Math.Max(baseline.Height, Math.Clamp(contentHeight, 0, 32768)));
    }

    public static int ResizeHitTest(string? direction) => direction switch
    {
        "w" => 10, "e" => 11, "n" => 12, "nw" => 13,
        "ne" => 14, "s" => 15, "sw" => 16, "se" => 17,
        _ => 0
    };

    public static Rectangle Fit(Size preferred, Point? location, Rectangle workArea, int dpi)
    {
        var scale = Math.Max(1, dpi) / 96d;
        var size = new Size(
            Math.Clamp((int)Math.Round(preferred.Width * scale), 1, Math.Max(1, workArea.Width - 32)),
            Math.Clamp((int)Math.Round(preferred.Height * scale), 1, Math.Max(1, workArea.Height - 32)));
        var point = location ?? new Point(workArea.Right - size.Width - 28, workArea.Bottom - size.Height - 96);
        return new Rectangle(
            Math.Clamp(point.X, workArea.Left, Math.Max(workArea.Left, workArea.Right - size.Width)),
            Math.Clamp(point.Y, workArea.Top, Math.Max(workArea.Top, workArea.Bottom - size.Height)),
            size.Width, size.Height);
    }
}

/// <summary>Visibility follows the latest user request, independently of fade/load completion.</summary>
internal sealed class CardWindowState
{
    private readonly Dictionary<string, (bool Visible, long Revision)> _cards = new();
    private long _revision;

    public bool IsVisible(string kind) => _cards.TryGetValue(kind, out var state) && state.Visible;
    public long Request(string kind, bool visible)
    {
        var revision = ++_revision;
        _cards[kind] = (visible, revision);
        return revision;
    }

    public bool IsCurrent(string kind, long revision) =>
        _cards.TryGetValue(kind, out var state) && state.Visible && state.Revision == revision;
}
