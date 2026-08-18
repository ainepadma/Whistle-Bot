using System.Drawing;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PetApp;

/// <summary>Standalone context-menu window (HTML styled) shown above the pet.
/// Lives outside the pet window so it is never clipped by the model bounds.</summary>
public sealed class MenuForm : DesktopOverlayForm
{
    private readonly WebView2 _web = new();
    private readonly Action<string, JsonElement> _messageHandler;

    public MenuForm(Action<string, JsonElement> messageHandler) : base(new Size(200, 160))
    {
        _messageHandler = messageHandler;

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(_web);

        Load += OnLoad;
        Deactivate += (_, _) => Hide();
    }

    private async void OnLoad(object? sender, EventArgs e)
    {

        var userData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BanyaoPet", "WebView2");
        var env = await CoreWebView2Environment.CreateAsync(null, userData);
        await _web.EnsureCoreWebView2Async(env);
        _web.CoreWebView2.WebMessageReceived += (_, args) =>
        {
            try
            {
                using var doc = JsonDocument.Parse(args.WebMessageAsJson);
                var root = doc.RootElement;
                _messageHandler(root.GetProperty("type").GetString(), root);
            }
            catch
            {
            }
        };
        _web.CoreWebView2.Navigate(WebAssets.Page("menu.html").ToString());
    }

    public void Post(object message)
    {
        try
        {
            if (_web.CoreWebView2 != null)
                _web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
        }
        catch
        {
        }
    }
}
