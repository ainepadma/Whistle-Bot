using PetApp.DesktopCards;
using PetApp;
using System.Text.Json;

namespace Schedule.Acceptance;

internal static class WindowsLayoutAcceptance
{
    public static void Run(Action<bool, string> pass)
    {
        var primary = new Rectangle(0, 0, 1920, 1040);
        var secondary = new Rectangle(1920, 0, 1920, 1040);
        var left = new Rectangle(-1920, -200, 1920, 1040);
        var preferred = new Size(960, 640);

        var restored = CardWindowLayout.Fit(preferred, new Point(2200, 200), secondary, 96);
        pass(restored.Location == new Point(2200, 200) && secondary.Contains(restored), "Card restore retains secondary monitor position");
        var negative = CardWindowLayout.Fit(preferred, new Point(-1750, -150), left, 144);
        pass(negative.Location == new Point(-1750, -150) && left.Contains(negative), "Card bounds support negative monitor coordinates and 150 percent DPI");

        var small = new Rectangle(0, 0, 1366, 728);
        var fitted = CardWindowLayout.Fit(preferred, null, small, 120);
        pass(small.Contains(fitted) && fitted.Size == new Size(1200, 696), "Initial 125 percent calendar fits a 1366 by 768 display work area");
        var tiny = new Rectangle(0, 0, 640, 400);
        var constrained = CardWindowLayout.Fit(preferred, new Point(900, 900), tiny, 192);
        pass(tiny.Contains(constrained) && constrained.Size == new Size(608, 368), "Small work area overrides normal card minimum size");
        var larger = CardWindowLayout.Fit(preferred, constrained.Location, primary, 96);
        pass(larger.Size == preferred, "Returning to a larger monitor restores the preferred size");
        pass(CardWindowLayout.Fit(preferred, fitted.Location, small, 120) == fitted, "Repeated viewport fitting does not drift");
        var disconnected = CardWindowLayout.Fit(preferred, new Point(2600, 400), primary, 96);
        pass(primary.Contains(disconnected), "Disconnected monitor fallback keeps the complete card reachable");

        var pet = new Rectangle(800, 640, 200, 270);
        var kite = PetAnimationLayout.Fit(pet, 200, true, 70, 96, primary);
        pass(kite == new Rectangle(800, 624, 200, 286), "Small kite viewport follows the chosen style instead of a fixed minimum size");
        pass(PetAnimationLayout.Fit(kite, 200, true, 70, 96, primary) == kite &&
             PetAnimationLayout.Fit(kite, 200, false, 70, 96, primary) == pet,
            "Kite viewport expansion is stable and restores the selected pet size");
        var dragged = new Rectangle(kite.X + 120, kite.Y - 80, kite.Width, kite.Height);
        pass(PetAnimationLayout.Fit(dragged, 200, false, 70, 96, primary) == new Rectangle(920, 560, 200, 270),
            "Kite viewport restores around its dragged position without jumping back");
        var highDpiPet = new Rectangle(-1400, 200, 300, 405);
        var highDpiKite = PetAnimationLayout.Fit(highDpiPet, 200, true, 70, 144, left);
        pass(highDpiKite == new Rectangle(-1400, 176, 300, 429),
            "Kite viewport respects negative monitor coordinates and 150 percent DPI");
        pass(PetAnimationLayout.Fit(new Rectangle(800, 220, 840, 980), 420, true, 70, 192,
                new Rectangle(0, 0, 2560, 1440)).Size == new Size(840, 980),
            "Kite animation never shrinks a larger user-selected pet at 200 percent DPI");
        var edgeKite = PetAnimationLayout.Fit(new Rectangle(1710, 770, 200, 270), 200, true, 70, 96, primary);
        pass(primary.Contains(edgeKite) && edgeKite == new Rectangle(1710, 754, 200, 286),
            "Kite animation stays inside the current monitor work area at the screen edge");
        var tinyKite = PetAnimationLayout.Fit(new Rectangle(40, 10, 200, 270), 200, true, 70, 192,
            new Rectangle(0, 0, 300, 240));
        pass(tinyKite == new Rectangle(0, 0, 300, 240),
            "Kite viewport remains reachable in a tiny display work area");
        pass(PetAnimationLayout.Fit(kite, 280, false, 70, 96, primary) == new Rectangle(760, 560, 280, 350),
            "Changing pet size during animation restores the new preference at the same bottom center");

        var mediumKite = PetAnimationLayout.Fit(pet, 250, true, 70, 96, primary);
        var largeKite = PetAnimationLayout.Fit(pet, 300, true, 70, 96, primary);
        pass(mediumKite.Size == new Size(250, 342) && largeKite.Size == new Size(300, 398),
            "Medium and large kite viewports preserve the style size mapping");
        foreach (var preset in new[] { 200, 250, 300 })
        {
            var fittedKite = PetAnimationLayout.Fit(pet, preset, true, 70, 144, primary);
            var face = (preset - 100) * (212d / 285) * 1.5;
            pass(fittedKite.Width / 1.5 >= face + 64 && fittedKite.Height / 1.5 >= face + 174,
                $"Kite style {preset} has room for its 1.5x face plus notes and streamers at 150 percent DPI");
        }

        var coloredPage = MainForm.BuildPetPageUri(new Uri("https://pet.local/index.html?v=42"), 250, "#8656f6", "br");
        pass(coloredPage.Fragment.Length == 0 && coloredPage.Query.Contains("color=%238656f6", StringComparison.Ordinal) &&
             coloredPage.Query.Contains("size=250", StringComparison.Ordinal) && coloredPage.Query.Contains("v=42", StringComparison.Ordinal) &&
             coloredPage.Query.EndsWith("pos=br", StringComparison.Ordinal),
            "Pet startup URI preserves the saved color, size, cache key and optional position");
        var escapedPage = MainForm.BuildPetPageUri(new Uri("https://pet.local/index.html"), 300, "#ff3347", "br&color=other");
        pass(escapedPage.Query.Contains("pos=br%26color%3Dother", StringComparison.Ordinal) && escapedPage.Fragment.Length == 0,
            "Pet startup URI encodes parameter values without changing appearance query boundaries");

        var state = new CardWindowState();
        var source = state.Request("today", true);
        var firstTarget = state.Request("calendar", true);
        state.Request("calendar", false);
        pass(!state.IsVisible("calendar") && !state.IsCurrent("calendar", firstTarget), "Card close publishes hidden immediately and invalidates pending reveal");
        state.Request("today", true);
        pass(!state.IsCurrent("today", source), "A newer switch invalidates an earlier source conceal callback");
        var reopened = state.Request("calendar", true);
        pass(state.IsVisible("calendar") && state.IsCurrent("calendar", reopened) && !state.IsCurrent("calendar", firstTarget), "Rapid close and reopen follows only the latest visibility request");

        var message = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 270,
            polygon = new[] { new[] { 80, 180 }, new[] { 120, 180 }, new[] { 120, 220 }, new[] { 80, 220 } },
            rects = new[] { new[] { 70, 60, 20, 80 }, new[] { 40, 240, 120, 20 } }
        });
        pass(PetHitRegion.TryCreate(message, new Size(400, 540), out var region), "Browser geometry builds a native region at 200 percent scale");
        using (region)
        {
            pass(region!.IsVisible(200, 400) && !region.IsVisible(5, 5), "Pet body remains interactive while transparent top corner passes through");
            pass(region.IsVisible(160, 140) && region.IsVisible(100, 500) && region.IsVisible(200, 496), "Native region retains note flight, tooltip and drop shadow");
            pass(!region.IsVisible(401, 400) && !region.IsVisible(200, 541), "Native region stays within the client viewport");
        }
        var invalid = JsonSerializer.SerializeToElement(new { width = 0, height = 270, polygon = Array.Empty<int[]>() });
        pass(!PetHitRegion.TryCreate(invalid, new Size(400, 540), out _), "Incomplete browser geometry cannot replace a valid region");

        var leftFace = new[] { new[] { 20, 40 }, new[] { 60, 40 }, new[] { 60, 80 }, new[] { 20, 80 } };
        var rightFace = new[] { new[] { 100, 40 }, new[] { 140, 40 }, new[] { 140, 80 }, new[] { 100, 80 } };
        var compatibilityHull = new[] { new[] { 20, 40 }, new[] { 140, 40 }, new[] { 140, 80 }, new[] { 20, 80 } };
        var animationMessage = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = true,
            polygon = compatibilityHull, polygons = new[] { leftFace, rightFace },
            rects = new[] { new[] { 80, 110, 12, 10 } }
        });
        pass(PetHitRegion.TryCreate(animationMessage, new Size(400, 240), out var animationRegion),
            "Animation builds independent face regions using actual browser-to-client scale");
        using (animationRegion)
        {
            pass(animationRegion!.IsVisible(80, 90) && animationRegion.IsVisible(240, 90) && !animationRegion.IsVisible(160, 90),
                "Separated kite faces retain their transparent gap despite the compatibility hull");
            pass(animationRegion.IsVisible(38, 90) && !animationRegion.IsVisible(34, 90) && !animationRegion.IsVisible(80, 135),
                "Animation allows only 1.5 CSS pixels of antialias edge and no ordinary pet shadow");
            pass(animationRegion.IsVisible(170, 170) && !animationRegion.IsVisible(401, 90),
                "Animation preserves explicit musical-note rectangles and stays within the client viewport");

            var malformedFaces = JsonSerializer.SerializeToElement(new
            {
                width = 200, height = 160, animation = true, polygon = compatibilityHull,
                polygons = new[] { leftFace, new[] { new[] { 80, 40 }, new[] { 80, 80 } } }
            });
            pass(!PetHitRegion.TryCreate(malformedFaces, new Size(400, 240), out var rejected) && rejected is null &&
                 animationRegion.IsVisible(80, 90) && !animationRegion.IsVisible(160, 90),
                "A malformed animation face rejects the entire message and preserves the existing region");
        }

        var ordinaryWithPieces = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = false,
            polygon = compatibilityHull, polygons = new[] { leftFace, rightFace }
        });
        pass(PetHitRegion.TryCreate(ordinaryWithPieces, new Size(200, 160), out var ordinaryRegion),
            "Ordinary pet messages remain compatible when optional polygon pieces are present");
        using (ordinaryRegion)
            pass(ordinaryRegion!.IsVisible(80, 60) && ordinaryRegion.IsVisible(40, 100),
                "Ordinary pet mode retains its original filled silhouette and drop-shadow allowance");

        var tooManyFaces = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = true, polygon = compatibilityHull,
            polygons = Enumerable.Repeat(leftFace, 161).ToArray()
        });
        pass(!PetHitRegion.TryCreate(tooManyFaces, new Size(200, 160), out _),
            "Animation rejects more than 160 independent polygon faces");
        var tooManyPoints = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = true, polygon = compatibilityHull,
            polygons = new[] { Enumerable.Range(0, 129).Select(i => leftFace[i % 4]).ToArray() }
        });
        pass(!PetHitRegion.TryCreate(tooManyPoints, new Size(200, 160), out _),
            "Animation rejects faces with more than 128 vertices");
        var missingPieces = JsonSerializer.SerializeToElement(new { width = 200, height = 160, animation = true, polygon = compatibilityHull });
        var emptyPieces = JsonSerializer.SerializeToElement(new { width = 200, height = 160, animation = true, polygon = compatibilityHull, polygons = Array.Empty<int[][]>() });
        pass(!PetHitRegion.TryCreate(missingPieces, new Size(200, 160), out _) &&
             !PetHitRegion.TryCreate(emptyPieces, new Size(200, 160), out _),
            "Missing or empty animation faces never fall back to the solid compatibility hull");
        using var nonfinitePoints = JsonDocument.Parse("""
            {"width":200,"height":160,"animation":true,"polygons":[[[20,40],[60,40],[60,1e39]]]}
            """);
        var degenerateFace = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = true,
            polygons = new[] { new[] { new[] { 20, 40 }, new[] { 40, 40 }, new[] { 60, 40 } } }
        });
        pass(!PetHitRegion.TryCreate(nonfinitePoints.RootElement, new Size(200, 160), out _) &&
             !PetHitRegion.TryCreate(degenerateFace, new Size(200, 160), out _) &&
             !PetHitRegion.TryCreate(JsonSerializer.SerializeToElement(new[] { 1, 2 }), new Size(200, 160), out _),
            "Nonfinite coordinates, degenerate faces and non-object messages cannot replace a valid region");
        var subpixelFace = JsonSerializer.SerializeToElement(new
        {
            width = 200, height = 160, animation = true,
            polygons = new[] { new[] { new[] { 20d, 40d }, new[] { 20.4, 40d }, new[] { 20.4, 40.4 }, new[] { 20d, 40.4 } } }
        });
        pass(PetHitRegion.TryCreate(subpixelFace, new Size(200, 160), out var smallFaceRegion),
            "Small fading whistle faces remain valid below one CSS pixel of area");
        smallFaceRegion?.Dispose();
    }
}
