using PetApp;

namespace PetApp.Schedule;

/// <summary>Capabilities exposed by the desktop-pet shell to the schedule UI.
/// The React renderer never owns native windows or the focus timer directly.</summary>
internal interface IScheduleDesktopHost
{
    void ShowPlanner();
    void ShowCard(string kind);
    void SwitchCard(string fromKind, string toKind);
    void CloseCard(string kind);
    bool IsCardVisible(string kind);
    CardPresentation GetCardPresentation(string kind);
    void BeginCardDrag(string kind);
    void ToggleCardPinned(string kind);
    void MoveCard(string kind, int deltaX, int deltaY);
    void ResizeCard(string kind, int width, int height);
    void FitCardContent(string kind, int height);
    void BeginCardResize(string kind, string direction);
    void ResetCardSize(string kind);

    bool IsAutostartEnabled();
    void SetAutostartEnabled(bool enabled);
    string GetPetColor();
    void ShowGuide();

    FocusState GetFocusState();
    void ToggleFocus();
    void ResetFocus();
    void SkipFocus();
    void SetFocusPreset(string presetId);
    void SetFocusCustom(int minutes, int breakMinutes, int longBreakMinutes, int rounds);
    void StartFocusForEvent(string? eventId);
    void DetachFocusEvent();
}

internal sealed record CardPresentation(string Kind, bool Visible, bool Pinned, bool AlwaysOnTop);
