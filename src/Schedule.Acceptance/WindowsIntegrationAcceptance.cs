using PetApp;
using WhistleBot.Bootstrap;

namespace Schedule.Acceptance;

internal static class WindowsIntegrationAcceptance
{
    internal static void Run(Action<bool, string> pass)
    {
        var target = @"C:\Users\Example User\Apps\WhistleBot\Bootstrap.exe";
        pass(WindowsIntegration.CommandTargets(WindowsIntegration.QuoteCommand(target), target),
            "Windows startup: quoted commands read back as enabled");
        pass(WindowsIntegration.CommandTargets(target.ToUpperInvariant(), target),
            "Windows startup: legacy unquoted paths and case differences are recognized");
        pass(!WindowsIntegration.CommandTargets(WindowsIntegration.QuoteCommand(target) + " --other", target) &&
             !WindowsIntegration.CommandTargets(@"C:\Other App\Bootstrap.exe", target),
            "Windows startup: another command or installation is not claimed");

        var app = @"C:\Users\Example User\Apps\WhistleBot";
        var command = WindowsIntegration.QuoteCommand(Path.Combine(app, "unins000.exe"));
        pass(WindowsIntegration.RegisteredUninstallerMatches(app, app + "\\", command),
            "Windows uninstall: matching installed directory and command are recognized");
        pass(!WindowsIntegration.RegisteredUninstallerMatches(app, @"C:\Other App", command) &&
             !WindowsIntegration.RegisteredUninstallerMatches(app, app, @"C:\Other App\unins000.exe") &&
             !WindowsIntegration.RegisteredUninstallerMatches(app, null, command),
            "Windows uninstall: unrelated or missing installation records are rejected");

        const string url = "https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/#download";
        pass(UpdateService.ReadValue("download_url: " + url + " # release page", "download_url") == url,
            "Update manifest: URL fragment survives while a trailing comment is removed");
        pass(UpdateService.ReadValue("download_url: \"" + url + "\" # release page", "download_url") == url &&
             UpdateService.ReadValue("download_url: '" + url + "' # release page", "download_url") == url,
            "Update manifest: both quoted URL forms retain fragments");
        pass(UpdateService.ReadValue("version: # absent\ndownload_url: " + url, "version") == null &&
             UpdateService.ReadValue("version:\ndownload_url: " + url, "version") == null,
            "Update manifest: an empty value never consumes the next line");
        pass(UpdateService.ReadValue("version: 1.2.0 # release", "version") == "1.2.0",
            "Update manifest: ordinary version comments remain supported");

        var temporaryRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "WhistleBot-runtime-tests-" + Guid.NewGuid().ToString("N")));
        Directory.CreateDirectory(temporaryRoot);
        try
        {
            var x86 = CreateRuntime(temporaryRoot, "x86", 0x014c, "9.0.8");
            var arm64 = CreateRuntime(temporaryRoot, "arm64", 0xaa64, "9.0.8");
            var old = CreateRuntime(temporaryRoot, "old", 0x8664, "8.0.8");
            var preview = CreateRuntime(temporaryRoot, "preview", 0x8664, "9.0.0-preview.1");
            var x64 = CreateRuntime(temporaryRoot, "user-x64", 0x8664, "9.0.8");
            pass(RuntimeDiscovery.FindRuntime(new[] { x86, arm64, old, preview }) == null,
                "Bootstrap: x86, ARM64, old and preview runtimes are rejected for the x64 app");
            pass(RuntimeDiscovery.FindRuntime(new[] { x86, arm64, x64 }) == x64 &&
                 RuntimeDiscovery.FindRuntime(new[] { x64 }) == x64,
                "Bootstrap: a complete user runtime can be rediscovered without registry or network");

            var partial = CreateRuntime(temporaryRoot, "partial", 0x8664, "9.0.8");
            File.Delete(Path.Combine(partial, "shared", "Microsoft.NETCore.App", "9.0.8", "coreclr.dll"));
            pass(RuntimeDiscovery.FindRuntime(new[] { partial, x64 }) == x64,
                "Bootstrap: an incomplete runtime does not mask a valid installation");

            var damaged = CreateRuntime(temporaryRoot, "damaged", 0x8664, "9.0.8");
            File.WriteAllBytes(Path.Combine(damaged, "host", "fxr", "9.0.8", "hostfxr.dll"), new byte[] { 0x4d, 0x5a });
            pass(!RuntimeDiscovery.HasX64DesktopRuntime(damaged),
                "Bootstrap: a truncated native library is rejected without crashing discovery");

            var mismatchedPatches = CreateRuntime(temporaryRoot, "mismatched-patches", 0x8664, "9.0.1");
            WriteDesktopRuntime(mismatchedPatches, 0x8664, "9.0.8");
            pass(!RuntimeDiscovery.HasX64DesktopRuntime(mismatchedPatches),
                "Bootstrap: Core 9.0.1 cannot satisfy selected Desktop 9.0.8 even with a complete older Desktop");

            var newerCore = CreateRuntime(temporaryRoot, "newer-core", 0x8664, "9.0.8");
            WritePe(Path.Combine(newerCore, "shared", "Microsoft.NETCore.App", "9.0.9", "coreclr.dll"), 0x8664);
            pass(RuntimeDiscovery.HasX64DesktopRuntime(newerCore),
                "Bootstrap: a newer x64 Core patch satisfies the selected Desktop patch");

            var brokenNewerDesktop = CreateRuntime(temporaryRoot, "broken-newer-desktop", 0x8664, "9.0.8");
            WritePe(Path.Combine(brokenNewerDesktop, "shared", "Microsoft.NETCore.App", "9.0.9", "coreclr.dll"), 0x8664);
            WriteDesktopRuntime(brokenNewerDesktop, 0x8664, "9.0.9");
            File.WriteAllBytes(Path.Combine(brokenNewerDesktop, "shared", "Microsoft.WindowsDesktop.App", "9.0.9", "PresentationNative_cor3.dll"), new byte[] { 0x4d, 0x5a });
            pass(!RuntimeDiscovery.HasX64DesktopRuntime(brokenNewerDesktop),
                "Bootstrap: a broken selected Desktop patch is not masked by a complete older patch");

            var wrongNewerCore = CreateRuntime(temporaryRoot, "wrong-newer-core", 0x8664, "9.0.8");
            WritePe(Path.Combine(wrongNewerCore, "shared", "Microsoft.NETCore.App", "9.0.9", "coreclr.dll"), 0x014c);
            pass(!RuntimeDiscovery.HasX64DesktopRuntime(wrongNewerCore),
                "Bootstrap: a selected x86 Core patch is not masked by an older x64 patch");
        }
        finally
        {
            // Only this run's freshly created GUID directory is removed.
            var expectedParent = Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath()));
            if (string.Equals(Path.GetDirectoryName(temporaryRoot), expectedParent, StringComparison.OrdinalIgnoreCase) &&
                Path.GetFileName(temporaryRoot).StartsWith("WhistleBot-runtime-tests-", StringComparison.Ordinal) &&
                (File.GetAttributes(temporaryRoot) & FileAttributes.ReparsePoint) == 0)
                Directory.Delete(temporaryRoot, recursive: true);
        }
    }

    private static string CreateRuntime(string temporaryRoot, string name, ushort machine, string version)
    {
        var root = Path.Combine(temporaryRoot, name);
        WritePe(Path.Combine(root, "host", "fxr", version, "hostfxr.dll"), machine);
        WritePe(Path.Combine(root, "shared", "Microsoft.NETCore.App", version, "coreclr.dll"), machine);
        WriteDesktopRuntime(root, machine, version);
        return root;
    }

    private static void WriteDesktopRuntime(string root, ushort machine, string version)
    {
        var desktop = Path.Combine(root, "shared", "Microsoft.WindowsDesktop.App", version);
        WritePe(Path.Combine(desktop, "PresentationNative_cor3.dll"), machine);
        File.WriteAllText(Path.Combine(desktop, "System.Windows.Forms.dll"), "test marker; never executed");
    }

    private static void WritePe(string path, ushort machine)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var file = File.Create(path);
        using var writer = new BinaryWriter(file);
        writer.Write((ushort)0x5a4d);
        file.Position = 0x3c;
        writer.Write(0x80);
        file.Position = 0x80;
        writer.Write(0x00004550u);
        writer.Write(machine);
    }
}
