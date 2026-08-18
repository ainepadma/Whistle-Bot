using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace PetApp;

/// <summary>Checks the public release manifest without downloading or replacing binaries automatically.</summary>
internal sealed class UpdateService
{
    internal const string ManifestUrl = "https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/version.yml";
    internal const string DefaultDownloadUrl = "https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/#download";
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(6) };

    public async Task CheckAsync(IWin32Window owner, bool interactive)
    {
        try
        {
            var manifest = await FetchAsync();
            var current = Assembly.GetEntryAssembly()?.GetName().Version ?? new Version(0, 0);
            if (manifest.Version > current)
            {
                var choice = MessageBox.Show(owner,
                    $"发现新版本 v{manifest.Version}，当前版本为 v{current.Major}.{current.Minor}.{Math.Max(0, current.Build)}。\n\n是否前往下载页面？",
                    "小鹞 WhistleBot 更新", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (choice == DialogResult.Yes)
                {
                    Process.Start(new ProcessStartInfo(manifest.DownloadUrl) { UseShellExecute = true });
                }
                return;
            }

            if (interactive)
            {
                MessageBox.Show(owner, $"当前已是最新版本 v{current.Major}.{current.Minor}.{Math.Max(0, current.Build)}。",
                    "检查更新", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
        catch
        {
            if (interactive)
            {
                MessageBox.Show(owner, "暂时无法连接更新服务，请检查网络后重试。",
                    "检查更新", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }

    private static async Task<UpdateManifest> FetchAsync()
    {
        var yaml = await Client.GetStringAsync(ManifestUrl);
        var versionText = ReadValue(yaml, "version") ?? throw new InvalidOperationException("版本文件缺少 version。");
        if (!Version.TryParse(versionText.TrimStart('v', 'V'), out var version))
            throw new InvalidOperationException("版本文件的 version 无效。");
        var download = ReadValue(yaml, "download_url") ?? DefaultDownloadUrl;
        if (!Uri.TryCreate(download, UriKind.Absolute, out var uri) ||
            !uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !uri.Host.Equals("ainepadma.cn", StringComparison.OrdinalIgnoreCase))
        {
            download = DefaultDownloadUrl;
        }
        return new UpdateManifest(version, download);
    }

    private static string? ReadValue(string yaml, string key)
    {
        var match = Regex.Match(yaml, $@"(?m)^\s*{Regex.Escape(key)}\s*:\s*(?<value>[^#\r\n]+)");
        return match.Success ? match.Groups["value"].Value.Trim().Trim('"', '\'') : null;
    }

    private sealed record UpdateManifest(Version Version, string DownloadUrl);
}