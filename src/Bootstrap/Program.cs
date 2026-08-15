using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Program
{
    private static string _runtimeDir = "";

    [STAThread]
    private static void Main()
    {
        if (HasDotNet9DesktopRuntime())
        {
            LaunchPet();
            return;
        }

        Application.EnableVisualStyles();
        var choice = MessageBox.Show(
            "小鹞 WhistleBot 需要 .NET 9 Desktop Runtime 才能运行，\n但你的电脑上还没有安装。\n\n" +
            "是否现在一键安装？（免管理员，安装到当前用户目录）",
            "小鹞 WhistleBot",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Information);

        if (choice == DialogResult.Yes)
        {
            if (InstallRuntime())
                LaunchPet();
            else
                MessageBox.Show("自动安装失败，请手动安装 .NET 9 Desktop Runtime 后重试。",
                    "小鹞 WhistleBot", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        else if (choice == DialogResult.No)
        {
            try { Process.Start("https://dotnet.microsoft.com/download/dotnet/9.0"); }
            catch { }
        }
    }

    private static bool HasDotNet9DesktopRuntime()
    {
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            using (var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
            {
                foreach (var sub in new[] { @"SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App",
                                            @"SOFTWARE\dotnet\Setup\InstalledVersions\x86\sharedfx\Microsoft.WindowsDesktop.App",
                                            @"SOFTWARE\dotnet\Setup\InstalledVersions\sharedfx\Microsoft.WindowsDesktop.App" })
                {
                    using (var key = baseKey.OpenSubKey(sub))
                    {
                        if (key == null) continue;
                        foreach (var name in key.GetValueNames())
                        {
                            if (name.StartsWith("9.", StringComparison.Ordinal))
                                return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private static bool InstallRuntime()
    {
        try
        {
            var script = Path.Combine(Path.GetTempPath(), "whistlebot-dotnet-install.ps1");
            using (var client = new WebClient())
                client.DownloadFile("https://dot.net/v1/dotnet-install.ps1", script);

            var installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Microsoft", "dotnet");
            var psi = new ProcessStartInfo("powershell.exe")
            {
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{script}\" " +
                            $"-Channel 9.0 -Runtime windowsdesktop -InstallDir \"{installDir}\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (var process = Process.Start(psi))
            {
                if (process == null) return false;
                process.WaitForExit();
                if (process.ExitCode != 0) return false;
            }
            _runtimeDir = installDir;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void LaunchPet()
    {
        var dir = AppDomain.CurrentDomain.BaseDirectory;
        var exe = Path.Combine(dir, "Pet.exe");
        if (!File.Exists(exe))
        {
            MessageBox.Show("找不到 Pet.exe，请确认程序文件完整。", "小鹞 WhistleBot",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        var psi = new ProcessStartInfo(exe)
        {
            WorkingDirectory = dir,
            UseShellExecute = false
        };
        if (_runtimeDir.Length > 0)
            psi.EnvironmentVariables["DOTNET_ROOT"] = _runtimeDir;
        Process.Start(psi);
    }
}
