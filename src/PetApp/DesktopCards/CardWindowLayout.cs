namespace PetApp.DesktopCards;

/// <summary>Fits a preferred CSS size without replacing it with a temporary monitor limit.</summary>
internal static class CardWindowLayout
{
    // CSS pixels: one size per role, independent of content and display scaling.
    public static Size PreferredSize(string kind) => kind is "calendar" or "manage"
        ? new Size(960, 680)
        : new Size(400, 480);

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
