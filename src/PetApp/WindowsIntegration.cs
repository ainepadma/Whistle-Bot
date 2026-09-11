using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace PetApp;

/// <summary>Windows integration with explicit ownership of startup/uninstall entries.</summary>
internal static class WindowsIntegration
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValue = "BanyaoPet";
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\7A2E4D0F-9B1C-4A3E-8F2D-6C5B4A3E2F10_is1";
    private const string WebViewDownloadUrl = "https://developer.microsoft.com/microsoft-edge/webview2/#download-section";
    private static string AutostartTarget => Path.Combine(AppContext.BaseDirectory, "Bootstrap.exe");

    internal static bool IsAutostartEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return CommandTargets(key?.GetValue(RunValue) as string, AutostartTarget);
        }
        catch { return false; }
    }

    internal static bool SetAutostart(bool enable)
    {
        if (enable)
        {
            if (!File.Exists(AutostartTarget)) throw new FileNotFoundException("未找到启动程序 Bootstrap.exe。", AutostartTarget);
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            key.SetValue(RunValue, QuoteCommand(AutostartTarget), RegistryValueKind.String);
        }
        else
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
            // Another portable copy may own the same named startup entry.
            if (CommandTargets(key?.GetValue(RunValue) as string, AutostartTarget)) key!.DeleteValue(RunValue, false);
        }
        return IsAutostartEnabled();
    }

    internal static string QuoteCommand(string path) => "\"" + path + "\"";

    internal static bool CommandTargets(string? command, string path)
    {
        if (string.IsNullOrWhiteSpace(command)) return false;
        var value = command.Trim();
        if (value.Length >= 2 && value[0] == '"' && value[^1] == '"') value = value[1..^1];
        return string.Equals(value, path, StringComparison.OrdinalIgnoreCase);
    }

    /// <returns>True when the host should close.</returns>
    internal static bool Uninstall(IWin32Window owner)
    {
        try
        {
            var uninstaller = FindRegisteredUninstaller(AppContext.BaseDirectory);
            if (uninstaller != null)
            {
                // Inno Setup owns its installed files, shortcuts and uninstall
                // registration, and presents its own confirmation dialog.
                Process.Start(new ProcessStartInfo(uninstaller)
                {
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(uninstaller)!
                });
                return true;
            }

            var choice = MessageBox.Show(owner,
                "当前目录没有本程序有效的安装登记，将按绿色版处理。\n\n" +
                "退出后，请手动移除本程序的 Bootstrap.exe、Pet.exe、schedule.ico 和 wwwroot，保留同目录的其他文件。\n" +
                "日程与个人设置会保留。\n\n是否关闭本程序并取消它的开机自启动？",
                "移除小鹞 WhistleBot", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (choice != DialogResult.Yes) return false;
            SetAutostart(false);
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(owner, "无法开始卸载：\n" + ex.Message, "移除小鹞 WhistleBot",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }
    }

    private static string? FindRegisteredUninstaller(string directory)
    {
        var expected = Path.Combine(Path.GetFullPath(directory), "unins000.exe");
        if (!File.Exists(expected)) return null;
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            using var root = RegistryKey.OpenBaseKey(hive, view);
            using var key = root.OpenSubKey(UninstallKey);
            if (key == null) continue;
            if (RegisteredUninstallerMatches(directory, key.GetValue("InstallLocation") as string,
                    key.GetValue("UninstallString") as string)) return expected;
        }
        return null;
    }

    internal static bool RegisteredUninstallerMatches(string directory, string? installedDirectory, string? command)
    {
        if (string.IsNullOrWhiteSpace(installedDirectory)) return false;
        try
        {
            var current = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory));
            var installed = Path.TrimEndingDirectorySeparator(Path.GetFullPath(installedDirectory));
            return string.Equals(current, installed, StringComparison.OrdinalIgnoreCase) &&
                   CommandTargets(command, Path.Combine(current, "unins000.exe"));
        }
        catch (ArgumentException) { return false; }
        catch (NotSupportedException) { return false; }
        catch (PathTooLongException) { return false; }
    }

    internal static bool EnsureWebView2Runtime(IWin32Window owner)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(CoreWebView2Environment.GetAvailableBrowserVersionString())) return true;
        }
        catch (WebView2RuntimeNotFoundException) { }
        catch (Exception ex)
        {
            MessageBox.Show(owner, "无法检测 WebView2 运行时：\n" + ex.Message, "小鹞 WhistleBot",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }
        if (MessageBox.Show(owner,
            "小鹞 WhistleBot 需要 Microsoft Edge WebView2 Runtime。\n\n" +
            "请选择官方网站中的 Evergreen 运行时安装，安装完成后重新打开程序。\n是否现在打开下载页面？",
            "缺少 WebView2 运行时", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
        {
            try { Process.Start(new ProcessStartInfo(WebViewDownloadUrl) { UseShellExecute = true }); }
            catch
            {
                MessageBox.Show(owner, "无法打开浏览器，请访问 Microsoft Edge WebView2 官方下载页面安装运行时。",
                    "小鹞 WhistleBot", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
        return false;
    }
}
