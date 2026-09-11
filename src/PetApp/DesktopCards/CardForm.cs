using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using PetApp.Schedule;
using System.Runtime.InteropServices;

namespace PetApp.DesktopCards;

internal sealed class CardForm : Form
{
    private readonly WebView2 _web = new();
    private readonly ScheduleStore _store;
    private readonly IScheduleDesktopHost _desktop;
    private readonly CardHostManager _manager;
    private ScheduleRpcBridge? _bridge;
    private System.Windows.Forms.Timer? _fadeTimer;
    private bool _contentReady;
    private bool _requestedVisible;
    private bool _activateOnReveal;
    private bool _nativeResizing;

    public event EventHandler? ContentReady;
    public bool IsContentReady => _contentReady;
    public bool IsNativeResizing => _nativeResizing;

    public CardForm(string kind, ScheduleStore store, IScheduleDesktopHost desktop, CardHostManager manager)
    {
        Kind = kind;
        _store = store;
        _desktop = desktop;
        _manager = manager;
        Text = kind switch
        {
            "calendar" => "日历",
            "next" => "行动",
            "manage" => "管理",
            _ => "今天"
        };

        // The entire client area is a WebView. Its CSS pixels are scaled explicitly
        // against the destination monitor, including before the first window handle.
        AutoScaleMode = AutoScaleMode.None;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.White;

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.White;
        Controls.Add(_web);
        Load += OnLoad;
        FormClosing += OnFormClosing;
        SizeChanged += (_, _) => UpdateRoundedRegion();
        DpiChanged += (_, args) =>
        {
            args.Cancel = true;
            _manager.OnDpiChanged(this, args.SuggestedRectangle, args.DeviceDpiNew);
            UpdateRoundedRegion();
        };
    }

    public void BeginNativeDrag()
    {
        NativeInput.BeginWindowDrag(this);
        _manager.RecordBounds(this);
    }

    public void BeginNativeResize(string direction)
    {
        var hitTest = CardWindowLayout.ResizeHitTest(direction);
        if (_nativeResizing || IsDisposed || !Visible || hitTest == 0) return;
        _nativeResizing = true;
        // Leave the WebView2 message callback before entering Windows' modal sizing
        // loop, otherwise it blocks further renderer callbacks for the whole drag.
        BeginInvoke((Action)(() => ResizeWithSystem(hitTest)));
    }

    private void ResizeWithSystem(int hitTest)
    {
        var initialSize = Size;
        try
        {
            if (IsDisposed || !Visible) return;
            // WebView2 owns the child HWND, so transparent DOM edge grips start the
            // system sizing loop explicitly instead of relying on parent hit testing.
            ReleaseCapture();
            var cursor = Cursor.Position;
            var coordinates = (cursor.Y << 16) | (cursor.X & 0xffff);
            SendMessage(Handle, 0x00A1, (IntPtr)hitTest, (IntPtr)coordinates);
        }
        finally
        {
            _nativeResizing = false;
        }
        if (!IsDisposed && Size != initialSize) _manager.RecordManualSize(this);
    }

    protected override void WndProc(ref Message message)
    {
        base.WndProc(ref message);
        if (message.Msg != 0x0024 || message.LParam == IntPtr.Zero) return; // WM_GETMINMAXINFO
        var screen = Screen.FromRectangle(Bounds);
        var dpi = DpiLayout.ForScreen(screen, DeviceDpi);
        var minimum = CardWindowLayout.Fit(CardWindowLayout.MinimumSize(Kind), null, screen.WorkingArea, dpi).Size;
        var limits = Marshal.PtrToStructure<MinMaxInfo>(message.LParam);
        limits.MinTrackSize = new NativePoint(minimum.Width, minimum.Height);
        limits.MaxTrackSize = new NativePoint(Math.Max(1, screen.WorkingArea.Width - 32),
            Math.Max(1, screen.WorkingArea.Height - 32));
        Marshal.StructureToPtr(limits, message.LParam, false);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        public int X;
        public int Y;
        public NativePoint(int x, int y) { X = x; Y = y; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MinMaxInfo
    {
        public NativePoint Reserved;
        public NativePoint MaxSize;
        public NativePoint MaxPosition;
        public NativePoint MinTrackSize;
        public NativePoint MaxTrackSize;
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);

    public void Reveal(bool activate = true)
    {
        _requestedVisible = true;
        _activateOnReveal = activate;
        StopFade();
        if (!Visible)
        {
            Opacity = 0;
            Show();
        }
        if (activate) Activate();
        if (_contentReady) FadeTo(1);
    }

    public void Conceal()
    {
        _requestedVisible = false;
        if (!Visible) return;
        FadeTo(0, () =>
        {
            if (!IsDisposed && !_requestedVisible) Hide();
        });
    }

    private void FadeTo(double target, Action? completed = null)
    {
        StopFade();
        if (!Visible || Math.Abs(Opacity - target) < 0.02)
        {
            Opacity = target;
            completed?.Invoke();
            return;
        }
        _fadeTimer = new System.Windows.Forms.Timer { Interval = 15 };
        _fadeTimer.Tick += (_, _) =>
        {
            var step = target > Opacity ? 0.18 : -0.22;
            var next = Math.Clamp(Opacity + step, 0, 1);
            var reached = target > Opacity ? next >= target : next <= target;
            Opacity = reached ? target : next;
            if (!reached) return;
            _fadeTimer?.Stop();
            _fadeTimer?.Dispose();
            _fadeTimer = null;
            completed?.Invoke();
        };
        _fadeTimer.Start();
    }

    private void UpdateRoundedRegion()
    {
        if (Width <= 0 || Height <= 0) return;
        var radius = Math.Min(Math.Min(Width, Height), Math.Max(2, (int)Math.Round(20 * DeviceDpi / 96f)));
        using var path = new System.Drawing.Drawing2D.GraphicsPath();
        path.AddArc(0, 0, radius, radius, 180, 90);
        path.AddArc(Width - radius, 0, radius, radius, 270, 90);
        path.AddArc(Width - radius, Height - radius, radius, radius, 0, 90);
        path.AddArc(0, Height - radius, radius, radius, 90, 90);
        path.CloseFigure();
        Region?.Dispose();
        Region = new Region(path);
    }
    public string Kind { get; }

    protected override bool ShowWithoutActivation => !_activateOnReveal;

    private void StopFade()
    {
        _fadeTimer?.Stop();
        _fadeTimer?.Dispose();
        _fadeTimer = null;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) StopFade();
        base.Dispose(disposing);
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.ApplicationExitCall || e.CloseReason == CloseReason.WindowsShutDown) return;
        e.Cancel = true;
        _manager.Hide(Kind);
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        UpdateRoundedRegion();
        var userData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BanyaoPet", "WebView2");
        var environment = await CoreWebView2Environment.CreateAsync(null, userData);
        await _web.EnsureCoreWebView2Async(environment);
        var root = Path.Combine(AppContext.BaseDirectory, "wwwroot", "motodo");
        _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "schedule.whistlebot.local", root, CoreWebView2HostResourceAccessKind.DenyCors);
        _bridge = new ScheduleRpcBridge(_web, _store, this, _desktop);
        _web.CoreWebView2.NavigationCompleted += (_, args) =>
        {
            if (!args.IsSuccess) return;
            _contentReady = true;
            ContentReady?.Invoke(this, EventArgs.Empty);
            if (_requestedVisible && Visible) FadeTo(1);
        };
        _web.CoreWebView2.Navigate($"https://schedule.whistlebot.local/index.html?mode=card&type={Uri.EscapeDataString(Kind)}");
    }
}
