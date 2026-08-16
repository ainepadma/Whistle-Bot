namespace PetApp;

/// <summary>Builds wwwroot page URIs with a cache-busting query derived from
/// the file's last write time, so a rebuilt app always loads the latest
/// HTML/JS/CSS even if the WebView2 disk cache still holds an old copy.</summary>
internal static class WebAssets
{
    public static Uri Page(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "wwwroot", fileName);
        var v = File.Exists(path) ? File.GetLastWriteTimeUtc(path).Ticks : 0;
        var builder = new UriBuilder(new Uri(path)) { Query = "v=" + v };
        return builder.Uri;
    }
}
