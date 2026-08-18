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
}
