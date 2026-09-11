namespace PetApp;

/// <summary>Persists the one-time welcome guide independently from appearance
/// settings, which may be rewritten whenever the user changes size or color.</summary>
internal static class GuideState
{
    private const string MarkerName = "welcome-guide.seen";

    public static bool ShouldShow(string configDirectory) =>
        !File.Exists(Path.Combine(configDirectory, MarkerName));

    public static void MarkSeen(string configDirectory)
    {
        Directory.CreateDirectory(configDirectory);
        File.WriteAllText(Path.Combine(configDirectory, MarkerName), "Preview v1.3.0");
    }
}
