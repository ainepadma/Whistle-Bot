namespace PetApp;

/// <summary>Resizes the temporary animation viewport around the pet's current
/// bottom center. All rectangles use physical desktop pixels.</summary>
internal static class PetAnimationLayout
{
    public static Rectangle Fit(Rectangle current, int petSize, bool active,
        int headroom, int dpi, Rectangle workArea)
    {
        var scale = Math.Max(1, dpi) / 96d;
        var logicalWidth = petSize;
        var logicalHeight = petSize + headroom;
        if (active)
        {
            // pet.js maps the style's 200/250/300 container presets to a
            // 100/150/200 SVG. Its visible whistle spans 212 of 285 viewBox
            // units. The kite face is 1.5 times that body, independent of the
            // transparent viewport; reserve room for sway, notes and streamers.
            var modelSize = Math.Clamp(petSize - 100, 100, 200);
            var kiteExtent = modelSize * (212d / 285) * 1.5;
            logicalWidth = Math.Max(logicalWidth, (int)Math.Ceiling(kiteExtent + 64));
            logicalHeight = Math.Max(logicalHeight, (int)Math.Ceiling(kiteExtent + 174));
        }
        var width = Math.Max(1, (int)Math.Round(logicalWidth * scale));
        var height = Math.Max(1, (int)Math.Round(logicalHeight * scale));
        // A tiny or remotely resized work area must still leave the viewport
        // reachable. The page lays out its model from the actual viewport.
        if (workArea.Width > 0 && workArea.Height > 0)
        {
            width = Math.Min(width, workArea.Width);
            height = Math.Min(height, workArea.Height);
        }
        var x = current.Left + (current.Width - width) / 2;
        var y = current.Bottom - height;
        if (workArea.Width > 0 && workArea.Height > 0)
        {
            x = Math.Clamp(x, workArea.Left, workArea.Right - width);
            y = Math.Clamp(y, workArea.Top, workArea.Bottom - height);
        }
        return new Rectangle(x, y, width, height);
    }
}
