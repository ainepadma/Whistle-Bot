using System.Runtime.InteropServices;

namespace PetApp;

/// <summary>Shared transparent, borderless desktop-overlay container.
/// Web content draws the visible card; the native host remains transparent.</summary>
public abstract class DesktopOverlayForm : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmExtendFrameIntoClientArea(IntPtr hWnd, ref Margins margins);

    [StructLayout(LayoutKind.Sequential)]
    private struct Margins
    {
        public int LeftWidth;
        public int RightWidth;
        public int TopHeight;
        public int BottomHeight;
    }

    protected DesktopOverlayForm(Size initialSize, bool topMost = true)
    {
        AutoScaleMode = AutoScaleMode.Dpi;
        AutoScaleDimensions = new SizeF(96F, 96F);
        FormBorderStyle = FormBorderStyle.None;
        TopMost = topMost;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        Size = initialSize;
        BackColor = Color.Black;
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        var margins = new Margins { LeftWidth = -1, RightWidth = -1, TopHeight = -1, BottomHeight = -1 };
        DwmExtendFrameIntoClientArea(Handle, ref margins);
    }
}
