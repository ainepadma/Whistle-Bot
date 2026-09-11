using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PetApp;

/// <summary>First-run and on-demand usage guide rendered with the same local
/// WebView assets as the desktop overlays.</summary>
public sealed class GuideForm : DesktopOverlayForm
{
    private readonly WebView2 _web = new();
    private readonly Action _ready;
    private readonly string _color;
    private readonly bool _firstRun;

    public GuideForm(string color, bool firstRun, Action ready) : base(new Size(540, 604))
    {
        _color = color;
        _firstRun = firstRun;
        _ready = ready;
        Text = "小鹞使用说明";

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(_web);
        Load += OnLoad;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        try
        {
            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BanyaoPet", "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, userData);
            await _web.EnsureCoreWebView2Async(env);
            _web.CoreWebView2.WebMessageReceived += OnMessage;
            var page = new UriBuilder(WebAssets.Page("guide.html"));
            page.Query = page.Query.TrimStart('?') + "&first=" + (_firstRun ? "1" : "0")
                + "&color=" + Uri.EscapeDataString(_color);
            _web.CoreWebView2.Navigate(page.Uri.AbsoluteUri);
        }
        catch
        {
            Close();
        }
    }

    private void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var document = JsonDocument.Parse(args.WebMessageAsJson);
            var root = document.RootElement;
            switch (root.GetProperty("type").GetString())
            {
                case "guide-ready":
                    _ready();
                    break;
                case "guide-drag":
                    NativeInput.BeginWindowDrag(this);
                    break;
                case "guide-close":
                    Close();
                    break;
            }
        }
        catch
        {
        }
    }
}
