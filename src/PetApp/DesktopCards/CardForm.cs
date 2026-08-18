using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using PetApp.Schedule;

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

    public event EventHandler? ContentReady;
    public bool IsContentReady => _contentReady;

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

        AutoScaleMode = AutoScaleMode.Dpi;
        AutoScaleDimensions = new SizeF(96F, 96F);
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        MinimumSize = kind == "calendar" ? new Size(760, 520) : kind == "manage" ? new Size(560, 480) : kind == "next" ? new Size(340, 280) : new Size(340, 260);
        BackColor = Color.White;

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.White;
        Controls.Add(_web);
        Load += OnLoad;
        FormClosing += OnFormClosing;
        SizeChanged += (_, _) => UpdateRoundedRegion();
        FormClosed += (_, _) => _fadeTimer?.Dispose();
    }

    public void BeginNativeDrag()
    {
        NativeInput.BeginWindowDrag(this);
        _manager.RecordBounds(this);
    }

    public void Reveal(bool activate = true)
    {
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
        if (!Visible) return;
        FadeTo(0, () =>
        {
            if (!IsDisposed) Hide();
        });
    }

    private void FadeTo(double target, Action? completed = null)
    {
        _fadeTimer?.Stop();
        _fadeTimer?.Dispose();
        _fadeTimer = null;
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
        var radius = Math.Max(2, (int)Math.Round(20 * DeviceDpi / 96f));
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
            if (Visible) FadeTo(1);
        };
        _web.CoreWebView2.Navigate($"https://schedule.whistlebot.local/index.html?mode=card&type={Uri.EscapeDataString(Kind)}");
    }
}
