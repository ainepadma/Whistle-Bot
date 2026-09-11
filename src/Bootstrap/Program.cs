using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows.Forms;
using Microsoft.Win32;
using WhistleBot.Bootstrap;

internal static class Program
{
    private static string _runtimeDir = "";

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        if (HasDotNet9DesktopRuntime())
        {
            LaunchPet();
            return;
        }

        var choice = MessageBox.Show(
            "小鹞 WhistleBot 需要 x64 .NET 9 Desktop Runtime 才能运行，\n未找到可用的运行时。\n\n" +
            "是否现在一键安装？（免管理员，安装到当前用户目录）",
            "小鹞 WhistleBot",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Information);

        if (choice == DialogResult.Yes)
        {
            if (InstallRuntime())
                LaunchPet();
            else
                MessageBox.Show("自动安装失败，请手动安装 x64 .NET 9 Desktop Runtime 后重试。",
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
        _runtimeDir = RuntimeDiscovery.FindRuntime(RuntimeCandidates()) ?? "";
        return _runtimeDir.Length > 0;
    }

    private static IEnumerable<string> RuntimeCandidates()
    {
        var candidates = new List<string>
        {
            Environment.GetEnvironmentVariable("DOTNET_ROOT_X64"),
            Environment.GetEnvironmentVariable("DOTNET_ROOT"),
            UserRuntimeDirectory,
            // Reuse installations created by earlier WhistleBot versions.
            Path.GetDirectoryName(UserRuntimeDirectory)
        };
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using (var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
                using (var key = baseKey.OpenSubKey(@"SOFTWARE\dotnet\Setup\InstalledVersions\x64"))
                {
                    if (key?.GetValue("InstallLocation") is string location) candidates.Add(location);
                }
            }
            catch (System.Security.SecurityException) { }
            catch (UnauthorizedAccessException) { }
        }
        var programFiles = Environment.GetEnvironmentVariable("ProgramW6432") ??
                           Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        candidates.Add(Path.Combine(programFiles, "dotnet"));
        // x64 .NET installations on Windows ARM64 use this subdirectory.
        candidates.Add(Path.Combine(programFiles, "dotnet", "x64"));
        return candidates;
    }

    private static string UserRuntimeDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "dotnet", "x64");

    private static bool InstallRuntime()
    {
        var temporaryDirectory = Path.Combine(Path.GetTempPath(), "whistlebot-runtime-" + Guid.NewGuid().ToString("N"));
        var script = Path.Combine(temporaryDirectory, "dotnet-install.ps1");
        try
        {
            Directory.CreateDirectory(temporaryDirectory);
            using (var client = new WebClient())
                client.DownloadFile("https://dot.net/v1/dotnet-install.ps1", script);

            // Explicitly provision both dependencies and the app's x64
            // architecture, even when launched on Windows ARM64.
            foreach (var runtime in new[] { "dotnet", "windowsdesktop" })
            {
                var psi = new ProcessStartInfo("powershell.exe")
                {
                    Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{script}\" " +
                                $"-Channel 9.0 -Runtime {runtime} -Architecture x64 -InstallDir \"{UserRuntimeDirectory}\"",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (var process = Process.Start(psi))
                {
                    if (process == null) return false;
                    process.WaitForExit();
                    if (process.ExitCode != 0) return false;
                }
            }
            return HasDotNet9DesktopRuntime();
        }
        catch
        {
            return false;
        }
        finally
        {
            try { File.Delete(script); Directory.Delete(temporaryDirectory); }
            catch { }
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
        {
            psi.EnvironmentVariables["DOTNET_ROOT"] = _runtimeDir;
            psi.EnvironmentVariables["DOTNET_ROOT_X64"] = _runtimeDir;
        }
        try { Process.Start(psi); }
        catch (Exception ex)
        {
            MessageBox.Show("无法启动小鹞 WhistleBot：\n" + ex.Message, "小鹞 WhistleBot",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
