using System.Runtime.InteropServices;

namespace PetApp;

/// <summary>Converts browser CSS pixels (96-DPI logical units) to the
/// physical pixels used by DPI-aware WinForms windows.</summary>
internal static class DpiLayout
{
    public static float Scale(Control control) => Math.Max(1f, control.DeviceDpi / 96f);

    public static int ToDevice(Control control, int logical) =>
        (int)Math.Round(logical * Scale(control));

    public static int ToLogical(Control control, int device) =>
        (int)Math.Round(device / Scale(control));

    public static Size ToDevice(Control control, Size logical) =>
        new(ToDevice(control, logical.Width), ToDevice(control, logical.Height));

    public static Size ToLogical(Control control, Size device) =>
        new(ToLogical(control, device.Width), ToLogical(control, device.Height));

    public static int ForScreen(Screen screen, int fallback = 96)
    {
        var center = new Point(screen.Bounds.Left + screen.Bounds.Width / 2,
            screen.Bounds.Top + screen.Bounds.Height / 2);
        var monitor = MonitorFromPoint(center, 2);
        return GetDpiForMonitor(monitor, 0, out var x, out _) == 0 ? (int)x : fallback;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromPoint(Point point, uint flags);

    [DllImport("shcore.dll")]
    private static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint dpiX, out uint dpiY);
}
