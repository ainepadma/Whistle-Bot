using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PetApp.Schedule;

/// <summary>Resizable planner shell that hosts the transplanted React UI.</summary>
internal sealed class PlannerForm : Form
{
    private readonly WebView2 _web = new();
    private readonly ScheduleStore _store;
    private readonly IScheduleDesktopHost _desktop;
    private ScheduleRpcBridge? _bridge;

    public PlannerForm(ScheduleStore store, IScheduleDesktopHost desktop)
    {
        _store = store;
        _desktop = desktop;
        AutoScaleMode = AutoScaleMode.Dpi;
        AutoScaleDimensions = new SizeF(96F, 96F);
        Text = "日程";
        var iconPath = Path.Combine(AppContext.BaseDirectory, "schedule.ico");
        if (File.Exists(iconPath))
        {
            using var sourceIcon = new Icon(iconPath);
            Icon = (Icon)sourceIcon.Clone();
        }
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1040, 720);
        MinimumSize = new Size(800, 600);
        _web.Dock = DockStyle.Fill;
        Controls.Add(_web);
        Load += OnLoad;
        FormClosing += (_, e) => { e.Cancel = true; Hide(); };
    }

    public void NotifyReminders() => _bridge?.Publish("reminder:triggered", null);
    private async void OnLoad(object? sender, EventArgs e)
    {
        var userData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BanyaoPet", "WebView2");
        var environment = await CoreWebView2Environment.CreateAsync(null, userData);
        await _web.EnsureCoreWebView2Async(environment);
        var root = Path.Combine(AppContext.BaseDirectory, "wwwroot", "motodo");
        _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "schedule.whistlebot.local", root, CoreWebView2HostResourceAccessKind.DenyCors);
        _bridge = new ScheduleRpcBridge(_web, _store, this, _desktop);
        _web.CoreWebView2.Navigate("https://schedule.whistlebot.local/index.html");
    }
}

