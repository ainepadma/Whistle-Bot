using System.Text.Json;

namespace PetApp.DesktopCards;

internal sealed class CardLayoutStore
{
    private readonly string _path;
    private readonly object _gate = new();
    private CardLayoutDocument _document;

    public CardLayoutStore(string? path = null)
    {
        _path = path ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BanyaoPet", "cards.json");
        _document = Load();
        MigrateCards();
    }

    public CardLayout Get(string kind)
    {
        lock (_gate)
        {
            if (_document.Cards.TryGetValue(kind, out var layout)) return layout;
            layout = Default(kind);
            _document.Cards[kind] = layout;
            SaveLocked();
            return layout;
        }
    }

    public IReadOnlyList<CardLayout> PinnedCards()
    {
        lock (_gate) return _document.Cards.Values.Where(x => x.Pinned && x.Visible).ToArray();
    }

    public void Save(CardLayout layout)
    {
        lock (_gate)
        {
            _document.Cards[layout.Kind] = layout;
            SaveLocked();
        }
    }

    private void MigrateCards()
    {
        lock (_gate)
        {
            if (_document.Version < 5)
            {
                ResizeLegacyCard("today", 352, 320);
                ResizeLegacyCard("todo", 352, 280);
                ResizeLegacyCard("upcoming", 352, 260);
                ResizeLegacyCard("focus", 332, 210);
                _document.Version = 5;
            }

            if (_document.Version >= 7) return;

            // Fold legacy single-purpose cards into one action card. Prefer the
            // focused task card's placement so currently pinned workflows stay put.
            if (!_document.Cards.ContainsKey("next"))
            {
                var source = new[] { "focus", "todo", "upcoming" }
                    .Select(kind => _document.Cards.TryGetValue(kind, out var layout) ? layout : null)
                    .FirstOrDefault(layout => layout is not null);
                if (source is not null)
                {
                    _document.Cards["next"] = new CardLayout
                    {
                        Kind = "next", X = source.X, Y = source.Y, Width = 390, Height = 420,
                        Visible = source.Visible, Pinned = source.Pinned, AlwaysOnTop = source.AlwaysOnTop
                    };
                }
            }

            if (!_document.Cards.ContainsKey("today") && _document.Cards.TryGetValue("quick", out var quick))
            {
                _document.Cards["today"] = new CardLayout
                {
                    Kind = "today", X = quick.X, Y = quick.Y, Width = 352, Height = 320,
                    Visible = quick.Visible, Pinned = quick.Pinned, AlwaysOnTop = quick.AlwaysOnTop
                };
            }

            foreach (var legacy in new[] { "focus", "todo", "upcoming", "quick" }) _document.Cards.Remove(legacy);
            foreach (var kind in new[] { "today", "next", "calendar", "manage" })
            {
                var size = CardWindowLayout.PreferredSize(kind);
                ResizeLegacyCard(kind, size.Width, size.Height);
            }
            _document.Version = 7;
            SaveLocked();
        }
    }

    private void ResizeLegacyCard(string kind, int width, int height)
    {
        if (!_document.Cards.TryGetValue(kind, out var layout)) return;
        layout.Width = width;
        layout.Height = height;
    }

    private CardLayoutDocument Load()
    {
        try
        {
            if (!File.Exists(_path)) return new CardLayoutDocument();
            return JsonSerializer.Deserialize<CardLayoutDocument>(File.ReadAllText(_path)) ?? new CardLayoutDocument();
        }
        catch
        {
            return new CardLayoutDocument();
        }
    }

    private void SaveLocked()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            File.WriteAllText(_path, JsonSerializer.Serialize(_document, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch
        {
            // Layout persistence must never prevent a card from opening.
        }
    }

    private static CardLayout Default(string kind)
    {
        var size = CardWindowLayout.PreferredSize(kind);
        return new CardLayout { Kind = kind, Width = size.Width, Height = size.Height, AlwaysOnTop = kind == "next" };
    }
}

internal sealed class CardLayoutDocument
{
    public int Version { get; set; } = 7;
    public Dictionary<string, CardLayout> Cards { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

internal sealed class CardLayout
{
    public string Kind { get; set; } = "today";
    public int X { get; set; } = int.MinValue;
    public int Y { get; set; } = int.MinValue;
    public int Width { get; set; } = 400;
    public int Height { get; set; } = 480;
    public bool Visible { get; set; }
    public bool Pinned { get; set; }
    public bool AlwaysOnTop { get; set; }
}
