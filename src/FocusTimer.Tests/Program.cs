using PetApp;

namespace FocusTimer.Tests;

/// <summary>Zero-dependency console test harness for FocusTimerService.
/// Run with: dotnet run --project src/FocusTimer.Tests</summary>
internal static class Program
{
    private static int _passed;
    private static int _failed;

    private static void Main()
    {
        Run("开始后按墙钟时间递减", TestCountdownByWallClock);
        Run("暂停/恢复保留剩余时间", TestPauseResumeKeepsRemaining);
        Run("跳过完成当前阶段并进入休息", TestSkipAdvancesToBreak);
        Run("关联跨轮保留且跳过记录真实时长", TestAssociationAndPartialDuration);
        Run("自然完成记录完整时长", TestAssociatedNaturalCompletion);
        Run("重置只重置当前阶段时长", TestResetKeepsPhase);
        Run("第四轮进入长休息并重置周期", TestLongBreakCycle);
        Run("切换预设仅允许未运行且清空周期", TestPresetSwitchRules);
        Run("手动时长设置、规则与持久化", TestCustomDuration);
        Run("JSON 持久化与重启恢复", TestPersistenceRestore);
        Run("运行中过期后推进并暂停+补发通知", TestExpiredRecovery);
        Console.WriteLine($"{_passed} passed, {_failed} failed");
        Environment.Exit(_failed == 0 ? 0 : 1);
    }

    private static void Run(string name, Action test)
    {
        try
        {
            test();
            _passed++;
            Console.WriteLine($"  PASS  {name}");
        }
        catch (Exception ex)
        {
            _failed++;
            Console.WriteLine($"  FAIL  {name}");
            Console.WriteLine($"        {ex.Message}");
        }
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }

    private sealed class ManualClock
    {
        public DateTime Now { get; set; } = DateTime.UtcNow;
    }

    private static (FocusTimerService Svc, ManualClock Clock, string Dir) NewService()
    {
        var dir = Path.Combine(Path.GetTempPath(), "focus-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var clock = new ManualClock();
        var svc = new FocusTimerService(Path.Combine(dir, "focus.json"), () => clock.Now);
        return (svc, clock, dir);
    }

    private static void TestCountdownByWallClock()
    {
        var (svc, clock, _) = NewService();
        svc.Toggle(); // start focus
        var s = svc.GetState();
        Assert(s.Mode == "focus" && s.Status == "running", "focus should be running");
        Assert(s.RemainingSeconds == 1500 && s.TotalSeconds == 1500, "starts at full 25 minutes");
        clock.Now = clock.Now.AddSeconds(10);
        svc.Refresh();
        Assert(svc.GetState().RemainingSeconds == 1490, "remaining follows the wall clock");
        svc.Dispose();
    }

    private static void TestPauseResumeKeepsRemaining()
    {
        var (svc, clock, _) = NewService();
        svc.Toggle();
        clock.Now = clock.Now.AddSeconds(37);
        svc.Refresh();
        svc.Toggle(); // pause
        var paused = svc.GetState();
        Assert(paused.Status == "paused" && paused.RemainingSeconds == 1463, "pause keeps remaining");
        clock.Now = clock.Now.AddMinutes(10);
        svc.Refresh();
        Assert(svc.GetState().RemainingSeconds == 1463, "paused time does not elapse");
        svc.Toggle(); // resume
        clock.Now = clock.Now.AddSeconds(20);
        svc.Refresh();
        Assert(svc.GetState().RemainingSeconds == 1443, "resume continues from remaining");
        svc.Dispose();
    }

    private static void TestSkipAdvancesToBreak()
    {
        var (svc, _, _) = NewService();
        FocusFinishedEventArgs? done = null;
        svc.PhaseFinished += (_, e) => done = e;
        svc.Skip(); // skip on idle is a no-op
        Assert(svc.GetState().Mode == "idle", "skip on idle does nothing");
        svc.Toggle();
        svc.Skip();
        var s = svc.GetState();
        Assert(s.Mode == "short-break" && s.Status == "running", "focus skip enters short break");
        Assert(s.TotalSeconds == 300 && s.RemainingSeconds == 300, "short break is 5 minutes");
        Assert(s.CycleIndex == 1, "cycle count incremented");
        Assert(done != null && done.CompletedPhase == "focus" && done.NextPhase == "short-break",
            "finished event raised with correct phases");
        done = null;
        svc.Skip(); // complete the break -> auto-starts next focus
        var next = svc.GetState();
        Assert(next.Mode == "focus" && next.Status == "running", "break skip auto-starts next focus");
        Assert(next.RemainingSeconds == 1500, "next focus shows full duration");
        Assert(done != null && done.CompletedPhase == "short-break" && done.NextPhase == "focus",
            "break finished event points to focus");
        svc.Dispose();
    }

    private static void TestAssociationAndPartialDuration()
    {
        var (svc, clock, _) = NewService();
        FocusFinishedEventArgs? done = null;
        svc.PhaseFinished += (_, e) => done = e;
        svc.StartForEvent("event-1");
        clock.Now = clock.Now.AddSeconds(37);
        svc.Refresh();
        svc.Skip();
        Assert(done != null && done.EventId == "event-1", "linked event id is emitted");
        Assert(done!.PlannedSeconds == 1500 && done.ActualSeconds == 37 && done.Skipped,
            "skip records elapsed time instead of the full plan");
        Assert(svc.GetState().ActiveEventId == "event-1", "association survives into the break");
        svc.Skip();
        Assert(svc.GetState().Mode == "focus" && svc.GetState().ActiveEventId == "event-1",
            "association survives into the next focus round");
        svc.DetachEvent();
        Assert(svc.GetState().ActiveEventId == null, "explicit detach ends the association");
        svc.Dispose();
    }

    private static void TestAssociatedNaturalCompletion()
    {
        var (svc, clock, _) = NewService();
        FocusFinishedEventArgs? done = null;
        svc.PhaseFinished += (_, e) => done = e;
        svc.StartForEvent("event-2");
        clock.Now = clock.Now.AddSeconds(1500);
        svc.Refresh();
        Assert(done != null && done.EventId == "event-2" && done.ActualSeconds == 1500,
            "natural completion records the full duration");
        Assert(!done!.Skipped && svc.GetState().ActiveEventId == "event-2",
            "natural completion remains linked for the next round");
        svc.Dispose();
    }

    private static void TestResetKeepsPhase()
    {
        var (svc, clock, _) = NewService();
        svc.Toggle();
        clock.Now = clock.Now.AddMinutes(10);
        svc.Refresh();
        svc.Reset();
        var s = svc.GetState();
        Assert(s.Mode == "focus" && s.Status == "paused", "reset pauses the current phase");
        Assert(s.RemainingSeconds == 1500 && s.TotalSeconds == 1500, "reset restores full duration");
        svc.Dispose();
    }

    private static void TestLongBreakCycle()
    {
        var (svc, _, _) = NewService();
        Assert(svc.GetState().Mode == "idle", "starts idle");
        for (var i = 0; i < 4; i++)
        {
            // Round 1 starts manually; later rounds auto-start after a break.
            if (svc.GetState().Status == "idle") svc.Toggle();
            svc.Skip();   // complete focus
            var afterFocus = svc.GetState();
            if (i < 3)
            {
                Assert(afterFocus.Mode == "short-break", "first three rounds use short break");
                Assert(afterFocus.CycleIndex == i + 1, "cycle index grows");
                svc.Skip(); // complete short break
                Assert(svc.GetState().Mode == "focus", "short break auto-starts focus");
            }
            else
            {
                Assert(afterFocus.Mode == "long-break", "4th round uses long break");
                Assert(afterFocus.CycleIndex == 4, "cycle index caps at 4");
                Assert(afterFocus.TotalSeconds == 900, "long break is 15 minutes");
                svc.Skip(); // complete long break
            }
        }
        var s = svc.GetState();
        Assert(s.CycleIndex == 0 && s.Mode == "focus" && s.Status == "running",
            "long break auto-starts focus and resets cycle");
        svc.Dispose();
    }

    private static void TestPresetSwitchRules()
    {
        var (svc, _, _) = NewService();
        svc.Toggle();
        svc.SetPreset("45-10");
        Assert(svc.GetState().PresetId == "25-5", "preset cannot change while running");
        svc.Toggle(); // pause
        svc.SetPreset("45-10");
        var s = svc.GetState();
        Assert(s.PresetId == "45-10", "preset switches when not running");
        Assert(s.Mode == "idle" && s.CycleIndex == 0, "preset switch resets mode and cycle");
        Assert(s.TotalSeconds == 2700, "45 min preset focus duration");
        svc.SetPreset("60-15");
        Assert(svc.GetState().TotalSeconds == 3600, "60 min preset focus duration");
        svc.SetPreset("nope");
        Assert(svc.GetState().PresetId == "60-15", "unknown preset ignored");
        svc.Dispose();
    }

    private static void TestPersistenceRestore()
    {
        var (svc, clock, dir) = NewService();
        svc.SetPreset("45-10");
        svc.Toggle();
        clock.Now = clock.Now.AddSeconds(123);
        svc.Refresh();
        svc.Toggle(); // pause
        svc.Dispose();

        using var restored = new FocusTimerService(Path.Combine(dir, "focus.json"), () => clock.Now);
        var s = restored.GetState();
        Assert(s.PresetId == "45-10", "preset restored");
        Assert(s.Mode == "focus" && s.Status == "paused", "paused focus restored");
        Assert(s.RemainingSeconds == 2577, $"remaining restored ({s.RemainingSeconds})");
    }

    private static void TestCustomDuration()
    {
        var (svc, clock, dir) = NewService();
        var fresh = svc.GetState();
        Assert(fresh.CustomMinutes == 45 && fresh.CustomBreakMinutes == 5
            && fresh.CustomLongBreakMinutes == 15 && fresh.CustomRounds == 6,
            "custom defaults are 45/5/15/6");
        svc.SetCustom(45, 10, 20, 3);
        var s = svc.GetState();
        Assert(s.PresetId == "custom" && s.Status == "idle", "custom preset applied");
        Assert(s.TotalSeconds == 2700 && s.CustomMinutes == 45, "custom focus length is 45 minutes");
        Assert(s.CustomBreakMinutes == 10 && s.CustomLongBreakMinutes == 20 && s.CustomRounds == 3,
            "custom break and rounds stored");
        svc.Toggle();
        svc.SetCustom(60, 5, 15, 4);
        Assert(svc.GetState().TotalSeconds == 2700, "custom cannot change while running");
        svc.Skip(); // focus done -> short break
        var br = svc.GetState();
        Assert(br.Mode == "short-break" && br.TotalSeconds == 600, "custom uses 10-minute short break");
        svc.Skip(); // break done -> auto-start focus (round 2)
        Assert(svc.GetState().Mode == "focus" && svc.GetState().Status == "running",
            "custom break auto-starts focus");
        svc.Skip(); // round 2 focus done -> short break
        svc.Skip(); // break done -> auto-start focus (round 3)
        svc.Skip(); // round 3 focus done -> long break (20 min)
        var lb = svc.GetState();
        Assert(lb.Mode == "long-break" && lb.TotalSeconds == 1200 && lb.CycleIndex == 3,
            "long break after the configured 3 rounds");
        svc.Skip(); // long break done -> auto-start focus, cycle 0
        var afterLong = svc.GetState();
        Assert(afterLong.Mode == "focus" && afterLong.Status == "running" && afterLong.CycleIndex == 0,
            "long break auto-starts focus and resets cycle");
        svc.SetCustom(120, 10, 30, 2);
        Assert(svc.GetState().TotalSeconds == 2700, "custom cannot change while running");
        svc.Toggle(); // pause
        svc.SetCustom(120, 10, 30, 2);
        var s2 = svc.GetState();
        Assert(s2.PresetId == "custom" && s2.TotalSeconds == 7200 && s2.CycleIndex == 0,
            "custom switch resets round and applies new length");
        svc.Dispose();

        var restored = new FocusTimerService(Path.Combine(dir, "focus.json"), () => clock.Now);
        var rs = restored.GetState();
        Assert(rs.PresetId == "custom" && rs.CustomMinutes == 120 && rs.CustomBreakMinutes == 10
            && rs.CustomLongBreakMinutes == 30 && rs.CustomRounds == 2 && rs.TotalSeconds == 7200,
            "full custom config restored after restart");
        restored.Dispose();
    }

    private static void TestExpiredRecovery()
    {
        var dir = Path.Combine(Path.GetTempPath(), "focus-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "focus.json");
        // Running focus whose end time passed while the app was closed.
        File.WriteAllText(path, """
            {"Version":1,"PresetId":"25-5","Mode":"focus","Status":"running","CycleIndex":1,"TotalSeconds":1500,"RemainingSeconds":1500,"EndTimeUtc":"2026-01-01T00:00:00Z","ActiveEventId":"event-recovery"}
            """);
        var clock = new ManualClock();
        var svc = new FocusTimerService(path, () => clock.Now);
        FocusFinishedEventArgs? done = null;
        svc.PhaseFinished += (_, e) => done = e;
        svc.Start(); // delivers the recovery notification
        var s = svc.GetState();
        Assert(s.Mode == "short-break" && s.Status == "paused", "expired focus recovers into paused break");
        Assert(s.TotalSeconds == 300 && s.RemainingSeconds == 300, "break duration restored");
        Assert(done != null && done.Recovered && done.CompletedPhase == "focus"
            && done.EventId == "event-recovery" && done.ActualSeconds == 1500,
            "recovery records the linked completed focus once");
        svc.Dispose();

        // Expired long break while closed → back to idle and round reset.
        var path2 = Path.Combine(dir, "focus2.json");
        File.WriteAllText(path2, """
            {"Version":1,"PresetId":"25-5","Mode":"long-break","Status":"running","CycleIndex":4,"TotalSeconds":900,"RemainingSeconds":900,"EndTimeUtc":"2026-01-01T00:00:00Z"}
            """);
        var svc2 = new FocusTimerService(path2, () => clock.Now);
        var s2 = svc2.GetState();
        Assert(s2.Mode == "focus" && s2.Status == "paused" && s2.CycleIndex == 0,
            "expired break recovers to a paused focus and resets cycle");
        svc2.Dispose();
    }
}
