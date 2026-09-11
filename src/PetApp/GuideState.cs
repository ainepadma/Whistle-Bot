namespace PetApp;

/// <summary>Persists the one-time welcome guide independently from appearance
/// settings, which may be rewritten whenever the user changes size or color.</summary>
internal static class GuideState
{
    private const string MarkerName = "welcome-guide.seen";
    internal const string CurrentRevision = "Preview v1.3.0-guide-2";

    public static bool ShouldShow(string configDirectory)
    {
        try
        {
            var path = Path.Combine(configDirectory, MarkerName);
            return !File.Exists(path) ||
                   !string.Equals(File.ReadAllText(path).Trim(), CurrentRevision, StringComparison.Ordinal);
        }
        catch
        {
            return true;
        }
    }

    public static void MarkSeen(string configDirectory)
    {
        Directory.CreateDirectory(configDirectory);
        File.WriteAllText(Path.Combine(configDirectory, MarkerName), CurrentRevision);
    }
}
