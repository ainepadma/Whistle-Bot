using System.Drawing.Drawing2D;
using System.Text.Json;

namespace PetApp;

/// <summary>Maps the browser's rendered geometry to a native window region.
/// Transparent space outside it is absent from Windows hit testing, including other processes.</summary>
internal static class PetHitRegion
{
    public static bool TryCreate(JsonElement message, Size clientSize, out Region? region)
    {
        region = null;
        if (message.ValueKind != JsonValueKind.Object || clientSize.Width <= 0 || clientSize.Height <= 0 ||
            !message.TryGetProperty("width", out var widthElement) ||
            !message.TryGetProperty("height", out var heightElement) ||
            !TryNumber(widthElement, out var width) || !TryNumber(heightElement, out var height) ||
            !float.IsFinite(width) || !float.IsFinite(height) || width <= 0 || height <= 0) return false;

        var scaleX = clientSize.Width / width;
        var scaleY = clientSize.Height / height;
        if (!float.IsFinite(scaleX) || !float.IsFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return false;
        var animation = false;
        if (message.TryGetProperty("animation", out var animationElement))
        {
            if (animationElement.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return false;
            animation = animationElement.GetBoolean();
        }
        var polygons = new List<PointF[]>();
        if (animation)
        {
            // Never replace invalid animation geometry with its compatibility
            // hull: that would turn transparent gaps between kite faces solid.
            if (!message.TryGetProperty("polygons", out var pieces) || pieces.ValueKind != JsonValueKind.Array ||
                pieces.GetArrayLength() is < 1 or > 160) return false;
            foreach (var piece in pieces.EnumerateArray())
            {
                if (!TryPolygon(piece, .0001, out var points)) return false;
                polygons.Add(points);
            }
        }
        else
        {
            if (!message.TryGetProperty("polygon", out var polygon) || !TryPolygon(polygon, 1, out var points)) return false;
            polygons.Add(points);
        }

        Region? result = null;
        try
        {
            result = new Region();
            result.MakeEmpty();
            foreach (var points in polygons)
            {
                using var shape = new GraphicsPath();
                shape.AddPolygon(points);
                result.Union(shape);
                // Widen's stroke is centered on the outline. A 3px pen adds
                // only 1.5 CSSpx outside each animation face, preserving gaps.
                using (var outline = (GraphicsPath)shape.Clone())
                using (var pen = new Pen(Color.Black, animation ? 3 : 16) { LineJoin = LineJoin.Round })
                {
                    outline.Widen(pen);
                    result.Union(outline);
                }
                if (!animation)
                {
                    // Preserve the ordinary pet's CSS drop shadow and frame
                    // movement allowance. Animation has independent geometry.
                    using var shadow = (GraphicsPath)shape.Clone();
                    using var offset = new Matrix(1, 0, 0, 1, 0, 14);
                    using var pen = new Pen(Color.Black, 80) { LineJoin = LineJoin.Round };
                    shadow.Transform(offset);
                    result.Union(shadow);
                    shadow.Widen(pen);
                    result.Union(shadow);
                }
            }

            if (message.TryGetProperty("rects", out var rects) && rects.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in rects.EnumerateArray().Take(16))
                {
                    if (item.ValueKind != JsonValueKind.Array || item.GetArrayLength() != 4) continue;
                    var values = item.EnumerateArray().Select(value => TryNumber(value, out var number) ? number : float.NaN).ToArray();
                    if (values.Any(value => !float.IsFinite(value) || Math.Abs(value) > 10000) || values[2] <= 0 || values[3] <= 0) continue;
                    result.Union(new RectangleF(values[0], values[1], values[2], values[3]));
                }
            }

            // Use the measured viewport ratio, not an assumed monitor DPI:
            // browser zoom can briefly differ while moving between displays.
            using var scale = new Matrix(scaleX, 0, 0, scaleY, 0, 0);
            result.Transform(scale);
            result.Intersect(new Rectangle(Point.Empty, clientSize));
            region = result;
            return true;
        }
        catch (Exception exception) when (exception is ArgumentException or System.Runtime.InteropServices.ExternalException or OutOfMemoryException)
        {
            // A failed GDI conversion must leave the host's previous region in
            // place; the partially built region is never returned to callers.
            return false;
        }
        finally
        {
            if (region is null) result?.Dispose();
        }
    }

    private static bool TryPolygon(JsonElement polygon, double minimumArea, out PointF[] points)
    {
        points = [];
        if (polygon.ValueKind != JsonValueKind.Array || polygon.GetArrayLength() is < 3 or > 128) return false;
        var parsed = new List<PointF>();
        foreach (var point in polygon.EnumerateArray())
        {
            if (point.ValueKind != JsonValueKind.Array || point.GetArrayLength() != 2 ||
                !TryNumber(point[0], out var x) || !TryNumber(point[1], out var y) ||
                !float.IsFinite(x) || !float.IsFinite(y) || Math.Abs(x) > 10000 || Math.Abs(y) > 10000) return false;
            parsed.Add(new PointF(x, y));
        }
        double area = 0;
        for (var index = 0; index < parsed.Count; index++)
        {
            var next = parsed[(index + 1) % parsed.Count];
            area += (double)parsed[index].X * next.Y - (double)next.X * parsed[index].Y;
        }
        if (Math.Abs(area) < minimumArea) return false;
        points = parsed.ToArray();
        return true;
    }

    private static bool TryNumber(JsonElement element, out float value)
    {
        value = 0;
        return element.ValueKind == JsonValueKind.Number && element.TryGetSingle(out value);
    }
}
