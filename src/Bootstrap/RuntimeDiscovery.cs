#nullable enable
using System;
using System.Collections.Generic;
using System.IO;

namespace WhistleBot.Bootstrap
{
    // Kept free of registry and UI calls so discovery can be checked against
    // isolated directories without installing or removing a system runtime.
    internal static class RuntimeDiscovery
    {
        internal static string? FindRuntime(IEnumerable<string?> candidates)
        {
            foreach (var candidate in candidates)
            {
                if (candidate == null || string.IsNullOrWhiteSpace(candidate)) continue;
                if (HasX64DesktopRuntime(candidate)) return Path.GetFullPath(candidate);
            }
            return null;
        }

        internal static bool HasX64DesktopRuntime(string root)
        {
            var host = FindLatestVersion(root, @"host\fxr");
            var core = FindLatestVersion(root, @"shared\Microsoft.NETCore.App");
            var desktop = FindLatestVersion(root, @"shared\Microsoft.WindowsDesktop.App");
            if (host == null || core == null || desktop == null) return false;

            // The app's default roll-forward selects the latest 9.0 patch,
            // not any older pair that happens to be complete. Conservatively
            // require Core >= Desktop: a Desktop patch can depend on that
            // same Core patch (for example Desktop 9.0.8 requires Core 9.0.8).
            // Validate the selected directories only, so a broken newer
            // runtime cannot be hidden by an intact older installation.
            if (core.Version < desktop.Version) return false;
            return IsX64Binary(Path.Combine(host.Directory, "hostfxr.dll")) &&
                   IsX64Binary(Path.Combine(core.Directory, "coreclr.dll")) &&
                   IsX64Binary(Path.Combine(desktop.Directory, "PresentationNative_cor3.dll")) &&
                   File.Exists(Path.Combine(desktop.Directory, "System.Windows.Forms.dll"));
        }

        private static RuntimeVersion? FindLatestVersion(string root, string relative)
        {
            try
            {
                var directory = Path.Combine(root, relative);
                if (!Directory.Exists(directory)) return null;
                RuntimeVersion? latest = null;
                foreach (var versionDirectory in Directory.EnumerateDirectories(directory))
                {
                    if (!Version.TryParse(Path.GetFileName(versionDirectory), out var version) ||
                        version.Major != 9 || version.Minor != 0 || version.Build < 0 || version.Revision >= 0)
                        continue;
                    if (latest == null || version > latest.Version) latest = new RuntimeVersion(version, versionDirectory);
                }
                return latest;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            catch (ArgumentException) { }
            catch (NotSupportedException) { }
            return null;
        }

        private sealed class RuntimeVersion
        {
            internal Version Version { get; }
            internal string Directory { get; }

            internal RuntimeVersion(Version version, string directory)
            {
                Version = version;
                Directory = directory;
            }
        }

        private static bool IsX64Binary(string path)
        {
            try
            {
                using (var stream = File.OpenRead(path))
                using (var reader = new BinaryReader(stream))
                {
                    if (stream.Length < 64 || reader.ReadUInt16() != 0x5a4d) return false;
                    stream.Position = 0x3c;
                    var offset = reader.ReadInt32();
                    if (offset < 64 || offset > stream.Length - 6) return false;
                    stream.Position = offset;
                    return reader.ReadUInt32() == 0x00004550 && reader.ReadUInt16() == 0x8664;
                }
            }
            catch (IOException) { return false; }
            catch (UnauthorizedAccessException) { return false; }
        }
    }
}
