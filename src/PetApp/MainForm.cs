using System.Drawing;
using System.Drawing.Drawing2D;
using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PetApp;

public sealed class MainForm : Form
{
    /// <summary>Extra transparent space above the pet where typing notes
    /// animate. The web view shifts the model down by this amount so the
    /// whistle silhouette still aligns with the visible pet.</summary>
    private const int NoteHeadroom = 70;

    private const string WhistlePath =
        "M114.500 9.000C116.441 9.267 122.257 10.114 126.144 10.605C130.031 11.096 133.950 11.375 137.823 11.946C141.695 12.517 145.550 13.213 149.378 14.031C153.206 14.848 157.025 15.782 160.790 16.851C164.556 17.921 168.407 18.875 171.972 20.447C175.536 22.018 178.853 24.209 182.174 26.280C185.495 28.351 188.935 30.350 191.897 32.875C194.859 35.399 197.630 38.312 199.947 41.427C202.263 44.541 204.557 47.946 205.796 51.561C207.034 55.175 207.238 59.252 207.377 63.112C207.517 66.973 205.971 71.023 206.632 74.725C207.293 78.427 209.827 81.751 211.344 85.326C212.861 88.902 214.563 92.461 215.734 96.178C216.904 99.896 217.731 103.773 218.368 107.630C219.005 111.486 219.337 115.413 219.556 119.319C219.774 123.225 219.954 127.173 219.680 131.066C219.407 134.959 218.698 138.844 217.915 142.676C217.133 146.507 216.144 150.319 214.985 154.056C213.825 157.792 212.509 161.510 210.958 165.095C209.408 168.681 207.786 172.296 205.682 175.570C203.578 178.844 200.910 181.793 198.335 184.740C195.760 187.688 193.082 190.591 190.232 193.255C187.383 195.918 184.506 198.636 181.237 200.720C177.968 202.804 174.173 204.112 170.618 205.758C167.062 207.404 163.471 208.992 159.904 210.596C156.337 212.200 152.918 214.207 149.215 215.382C145.511 216.557 141.516 216.854 137.681 217.645C133.847 218.437 130.069 219.537 126.206 220.132C122.342 220.727 118.402 221.216 114.500 221.216C110.598 221.216 106.658 220.727 102.794 220.132C98.931 219.537 95.153 218.437 91.319 217.645C87.484 216.854 83.489 216.557 79.785 215.382C76.082 214.207 72.663 212.200 69.096 210.596C65.529 208.992 61.938 207.404 58.382 205.758C54.827 204.112 51.032 202.804 47.763 200.720C44.494 198.636 41.617 195.918 38.768 193.255C35.918 190.591 33.240 187.688 30.665 184.740C28.090 181.793 25.422 178.844 23.318 175.570C21.214 172.296 19.592 168.681 18.042 165.095C16.491 161.510 15.175 157.792 14.015 154.056C12.856 150.319 11.867 146.507 11.085 142.676C10.302 138.844 9.593 134.959 9.320 131.066C9.046 127.173 9.226 123.225 9.444 119.319C9.663 115.413 9.995 111.486 10.632 107.630C11.269 103.773 12.096 99.896 13.266 96.178C14.437 92.461 16.139 88.902 17.656 85.326C19.173 81.751 21.707 78.427 22.368 74.725C23.029 71.023 21.483 66.973 21.623 63.112C21.762 59.252 21.966 55.175 23.204 51.561C24.443 47.946 26.737 44.541 29.053 41.427C31.370 38.312 34.141 35.399 37.103 32.875C40.065 30.350 43.505 28.351 46.826 26.280C50.147 24.209 53.464 22.018 57.028 20.447C60.593 18.875 64.444 17.921 68.210 16.851C71.975 15.782 75.794 14.848 79.622 14.031C83.450 13.213 87.305 12.517 91.177 11.946C95.050 11.375 98.969 11.096 102.856 10.605C106.743 10.114 112.559 9.267 114.500 9.000Z";

    private const string RunKeyName = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "BanyaoPet";
    private static string ConfigDir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BanyaoPet");
    private static string ConfigPath => Path.Combine(ConfigDir, "config.json");

    private readonly WebView2 _web = new();
    private readonly System.Windows.Forms.Timer _idleTimer = new() { Interval = 1000 };
    private readonly System.Windows.Forms.Timer _noteZoneTimer = new() { Interval = 1800 };
    private readonly NotifyIcon _tray;
    private MenuForm? _menuForm;
    private string _petColor = "#2f86ed";
    private bool _noteZoneActive;
    private Point _menuAnchor;
    private Size? _collapsedSize;
    private Size? _styleSize;
    private Size? _settingsSize;
    private Size? _bothSize;
    private FocusTimerService? _focusTimer;
    private FocusForm? _focusForm;

    private static readonly bool DebugMode =
        Environment.GetCommandLineArgs().Any(a => string.Equals(a, "debug=1", StringComparison.OrdinalIgnoreCase));

    private static void Log(string message)
    {
        if (!DebugMode) return;
        try
        {
            Directory.CreateDirectory(ConfigDir);
            File.AppendAllText(Path.Combine(ConfigDir, "menu-debug.log"),
                $"{DateTime.Now:HH:mm:ss.fff} {message}\r\n");
        }
        catch
        {
        }
    }

    [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
    private static extern int DwmExtendFrameIntoClientArea(IntPtr hWnd, ref Margins pMarInset);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct Margins
    {
        public int LeftWidth, RightWidth, TopHeight, BottomHeight;
    }

    public MainForm()
    {
        Text = "小鹞 WhistleBot";
        FormBorderStyle = FormBorderStyle.None;
        TopMost = true;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        Size = new Size(LoadSize(), LoadSize() + NoteHeadroom);
        BackColor = Color.Black;

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(_web);

        _tray = new NotifyIcon { Visible = true, Text = "小鹞 WhistleBot" };
        _tray.Icon = MakeIcon();
        var menu = new ContextMenuStrip();
        menu.Items.Add("显示", null, (_, _) => { Show(); WindowState = FormWindowState.Normal; });
        menu.Items.Add("专注计时", null, (_, _) => ShowFocus());
        menu.Items.Add("退出", null, (_, _) => Close());
        _tray.ContextMenuStrip = menu;
        _tray.BalloonTipClicked += (_, _) => ShowFocus();
        _noteZoneTimer.Tick += (_, _) =>
        {
            _noteZoneTimer.Stop();
            _noteZoneActive = false;
            ApplyPetRegion();
        };

        Load += OnLoad;
        FormClosing += (_, _) =>
        {
            NativeInput.StopKeyboardHook();
            _idleTimer.Stop();
            _noteZoneTimer.Stop();
            _focusTimer?.Dispose();
            _tray.Visible = false;
            _tray.Dispose();
        };
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        // DWM glass: black pixels become transparent on Win10/11, so the pet
        // floats on the desktop while the window still receives mouse input.
        var margins = new Margins { LeftWidth = -1, RightWidth = -1, TopHeight = -1, BottomHeight = -1 };
        DwmExtendFrameIntoClientArea(Handle, ref margins);

        // Place the pet at the bottom-right of the primary screen.  WorkingArea
        // is in physical pixels while Form size/location are DPI-scaled logical
        // pixels, so convert explicitly to keep the window on screen at any DPI.
        var wa = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1024, 768);
        var scale = DeviceDpi / 96f;
        var logicalWa = new Rectangle(
            (int)Math.Round(wa.X / scale),
            (int)Math.Round(wa.Y / scale),
            (int)Math.Round(wa.Width / scale),
            (int)Math.Round(wa.Height / scale));
        Location = new Point(logicalWa.Right - Width - 24, logicalWa.Bottom - Height - 24);

        var userData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BanyaoPet", "WebView2");
        var env = await CoreWebView2Environment.CreateAsync(null, userData);
        await _web.EnsureCoreWebView2Async(env);
        try
        {
            // Force fresh wwwroot assets on every launch: WebView2 may keep
            // serving stale cached copies of pet.js/pet.css, which are linked
            // without version queries from the (cache-busted) HTML pages.
            await _web.CoreWebView2.Profile.ClearBrowsingDataAsync(
                CoreWebView2BrowsingDataKinds.DiskCache);
        }
        catch
        {
        }
        _web.CoreWebView2.WebMessageReceived += OnWebMessage;
        _petColor = LoadColor();
        var indexUri = WebAssets.Page("index.html");
        var builder = new UriBuilder(indexUri);
        builder.Query = (string.IsNullOrEmpty(builder.Query) ? "" : builder.Query.TrimStart('?') + "&")
            + "size=" + Width + "&color=" + _petColor;
        var args = Environment.GetCommandLineArgs();
        if (args.Length > 1 && args[1].StartsWith("pos=", StringComparison.Ordinal))
            builder.Query += "&" + args[1];
        _web.CoreWebView2.Navigate(builder.Uri.ToString());
        Post(new { type = "set-color", color = _petColor });
        Post(new { type = "size", size = Width });
        ApplyPetRegion();

        // Preload the menu form hidden/off-screen so its WebView is already
        // painted before the first right-click (no first-open flicker).
        _menuForm = new MenuForm(OnMenuMessage);
        _menuForm.Opacity = 0;
        _menuForm.Location = new Point(-32000, -32000);
        _menuForm.Show();
        _menuForm.Hide();
        _menuForm.Opacity = 1;

        _idleTimer.Tick += (_, _) => Post(new { type = "systemIdle", seconds = NativeInput.GetIdleSeconds() });
        _idleTimer.Start();

        _focusTimer = new FocusTimerService();
        _focusTimer.StateChanged += OnFocusStateChanged;
        _focusTimer.PhaseFinished += OnFocusPhaseFinished;
        _focusTimer.Start();

        NativeInput.KeyDown += vk => Post(new { type = "typing", key = vk });
        NativeInput.StartKeyboardHook();
    }

    /// <summary>Clip the window to the whistle silhouette so transparent areas
    /// do not swallow clicks and only the model itself is interactive.</summary>
    private void ApplyPetRegion()
    {
        try
        {
            var scale = Width / 229f;
            var numbers = Regex.Matches(WhistlePath, @"-?\d+(?:\.\d+)?")
                .Select(m => float.Parse(m.Value, System.Globalization.CultureInfo.InvariantCulture))
                .ToArray();
            var path = new GraphicsPath();
            var current = new PointF(numbers[0] * scale, numbers[1] * scale);
            path.AddLine(current, current);
            for (var i = 2; i + 5 < numbers.Length; i += 6)
            {
                var c1 = new PointF(numbers[i] * scale, numbers[i + 1] * scale);
                var c2 = new PointF(numbers[i + 2] * scale, numbers[i + 3] * scale);
                var end = new PointF(numbers[i + 4] * scale, numbers[i + 5] * scale);
                path.AddBezier(current, c1, c2, end);
                current = end;
            }
            path.CloseFigure();
            using (var m = new Matrix())
            {
                m.Translate(0, NoteHeadroom);
                path.Transform(m);
            }
            var region = new Region(path);
            // While typing notes animate above the pet, include a transparent
            // note zone so the pop-up notes are not clipped by the silhouette.
            if (_noteZoneActive)
                region.Union(new Region(new Rectangle((Width - 140) / 2, 0, 140, NoteHeadroom + 40)));
            Region = region;
        }
        catch
        {
            // Keep the full window if the path fails to parse.
        }
    }

    private void Post(object message)
    {
        try
        {
            if (_web.CoreWebView2 != null)
                _web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
        }
        catch
        {
            // WebView2 may not be ready yet; ignore.
        }
    }

    private void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();
                switch (type)
            {
                case "drag":
                    var dx = root.GetProperty("dx").GetInt32();
                    var dy = root.GetProperty("dy").GetInt32();
                    Location = new Point(Location.X + dx, Location.Y + dy);
                    break;
                case "note-spawn":
                    _noteZoneActive = true;
                    _noteZoneTimer.Stop();
                    _noteZoneTimer.Start();
                    ApplyPetRegion();
                    break;
                case "quit":
                    Close();
                    break;
                case "menu-open":
                    ShowPetMenu(
                        new Point(root.GetProperty("x").GetInt32(), root.GetProperty("y").GetInt32()),
                        root.GetProperty("iw").GetInt32(),
                        root.GetProperty("ih").GetInt32());
                    break;
                case "move":
                    MovePetToEdge(root.GetProperty("pos").GetString());
                    break;
            }
        }
        catch
        {
            // Ignore malformed messages.
        }
    }

    private static int LoadSize()
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(ConfigPath));
            return Math.Clamp(doc.RootElement.GetProperty("size").GetInt32(), 180, 420);
        }
        catch
        {
            return 200;
        }
    }

    private void ShowPetMenu(Point pagePos, int pageWidth, int pageHeight)
    {
        _menuForm ??= new MenuForm(OnMenuMessage);
        // Hide first so a reopen always starts from the collapsed size without
        // the previous expanded window flashing at the new anchor.
        _menuForm.Hide();
        _menuForm.Post(new { type = "reset" });
        _menuForm.Post(new
        {
            type = "state",
            color = _petColor,
            size = Width,
            autostart = IsAutostartEnabled()
        });
        var client = new Point(
            pageWidth > 0 ? (int)Math.Round(pagePos.X * (ClientSize.Width / (float)pageWidth)) : pagePos.X,
            pageHeight > 0 ? (int)Math.Round(pagePos.Y * (ClientSize.Height / (float)pageHeight)) : pagePos.Y);
        _menuAnchor = PointToScreen(client);
        _menuForm.Size = _collapsedSize ?? new Size(200, 160);
        PositionPetMenu();
        _menuForm.Show();
        _menuForm.Activate();
    }

    private void PositionPetMenu()
    {
        if (_menuForm == null) return;
        var w = _menuForm.Width;
        var h = _menuForm.Height;
        var wa = Screen.PrimaryScreen?.WorkingArea ?? Rectangle.Empty;
        var s = DeviceDpi / 96f;
        var logicalWa = new Rectangle(
            (int)Math.Round(wa.X / s),
            (int)Math.Round(wa.Y / s),
            (int)Math.Round(wa.Width / s),
            (int)Math.Round(wa.Height / s));

        // The menu's top-left sits at the right-click point and only flips at
        // screen edges like a normal context menu. Expanding the style/settings
        // sections grows the same window in place from this anchor.
        var x = _menuAnchor.X;
        var y = _menuAnchor.Y;
        if (x + w > logicalWa.Right) x = Math.Max(logicalWa.Left, _menuAnchor.X - w);
        if (y + h > logicalWa.Bottom) y = Math.Max(logicalWa.Top, _menuAnchor.Y - h);
        x = Math.Clamp(x, logicalWa.Left, Math.Max(logicalWa.Left, logicalWa.Right - w));
        y = Math.Clamp(y, logicalWa.Top, Math.Max(logicalWa.Top, logicalWa.Bottom - h));
        _menuForm.Location = new Point(x, y);
    }

    private void OnMenuMessage(string type, JsonElement root)
    {
        switch (type)
        {
            case "get-state":
                _menuForm?.Post(new
                {
                    type = "state",
                    color = _petColor,
                    size = Width,
                    autostart = IsAutostartEnabled()
                });
                break;
            case "color":
                _petColor = root.GetProperty("color").GetString() ?? "#2f86ed";
                SaveConfig(Width, _petColor);
                Post(new { type = "set-color", color = _petColor });
                break;
            case "size":
                ResizePet(root.GetProperty("size").GetInt32());
                break;
            case "autostart":
                SetAutostart(root.GetProperty("enable").GetBoolean());
                break;
            case "shortcut":
                CreateDesktopShortcut();
                break;
            case "about":
                OpenAbout();
                break;
            case "uninstall":
                Uninstall();
                break;
            case "hide":
                Hide();
                break;
            case "quit":
                Post(new { type = "quit" });
                break;
            case "open-focus":
                _menuForm?.Hide();
                ShowFocus();
                break;
            case "close-menu":
                _menuForm?.Hide();
                break;
            case "sizes":
                StoreMenuSizes(root);
                break;
            case "expand":
                if (_menuForm == null) break;
                var target = root.GetProperty("target").GetString();
                var otherOpen = root.TryGetProperty("both", out var both) && both.GetBoolean();
                var desired = target switch
                {
                    "style" => otherOpen ? _bothSize : _styleSize,
                    "settings" => otherOpen ? _bothSize : _settingsSize,
                    _ => null
                };
                if (desired.HasValue) _menuForm.Size = desired.Value;
                PositionPetMenu();
                _menuForm.Post(new { type = "expanded", target });
                break;
            case "fit":
                ResizeMenuToFit(root);
                break;
            case "debug-layout":
                Log($"layout inner={root.GetProperty("innerWidth").GetInt32()} dpr={root.GetProperty("dpr").GetDouble()} " +
                    $"menu={root.GetProperty("menu").GetRawText()} colors={root.GetProperty("colors").GetRawText()} " +
                    $"sizes={root.GetProperty("sizes").GetRawText()} " +
                    $"collapsed={root.GetProperty("collapsed").GetRawText()} style={root.GetProperty("style").GetRawText()} " +
                    $"settings={root.GetProperty("settings").GetRawText()} both={root.GetProperty("both").GetRawText()}");
                break;
        }
    }

    private void OnFocusStateChanged(object? sender, EventArgs e)
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            try { BeginInvoke(PushFocusState); } catch { }
            return;
        }
        PushFocusState();
    }

    private void OnFocusPhaseFinished(object? sender, FocusFinishedEventArgs e)
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            try { BeginInvoke(() => OnFocusPhaseFinishedCore(e)); } catch { }
            return;
        }
        OnFocusPhaseFinishedCore(e);
    }

    private void OnFocusPhaseFinishedCore(FocusFinishedEventArgs e)
    {
        var text = e.CompletedPhase switch
        {
            "focus" when e.NextPhase == "long-break" => "专注完成！已完成一轮，来一次长休息吧。",
            "focus" => "专注完成！休息一下吧。",
            "long-break" => "长休息结束，已自动开始下一轮专注！",
            _ => "休息结束，已自动开始下一轮专注！"
        };
        try
        {
            _tray.ShowBalloonTip(4000, "小鹞 WhistleBot", text, ToolTipIcon.Info);
        }
        catch
        {
        }
        Post(new { type = "toast", text });
        _focusForm?.Post(new { type = "focus-finished", phase = e.CompletedPhase, next = e.NextPhase, text });
        PushFocusState();
    }

    private void PushFocusState()
    {
        var s = _focusTimer?.GetState();
        if (s == null) return;
        var msg = new
        {
            type = "focus-state",
            mode = s.Mode,
            status = s.Status,
            remainingSeconds = s.RemainingSeconds,
            totalSeconds = s.TotalSeconds,
            presetId = s.PresetId,
            cycleIndex = s.CycleIndex,
            customMinutes = s.CustomMinutes,
            customBreakMinutes = s.CustomBreakMinutes,
            customLongBreakMinutes = s.CustomLongBreakMinutes,
            customRounds = s.CustomRounds,
            label = s.Label
        };
        Post(msg);
        _focusForm?.Post(msg);
    }

    private void ShowFocus()
    {
        _focusForm ??= new FocusForm(OnFocusMessage);
        _focusForm.Hide();
        var scale = DeviceDpi / 96f;
        var wa = Screen.PrimaryScreen?.WorkingArea ?? Rectangle.Empty;
        var logicalWa = new Rectangle(
            (int)Math.Round(wa.X / scale),
            (int)Math.Round(wa.Y / scale),
            (int)Math.Round(wa.Width / scale),
            (int)Math.Round(wa.Height / scale));
        var w = _focusForm.Width;
        var h = _focusForm.Height;
        var x = Location.X + (Width - w) / 2;
        var y = Location.Y + NoteHeadroom - h - 10;
        if (y < logicalWa.Top) y = Location.Y + Height + 10;
        x = Math.Clamp(x, logicalWa.Left, Math.Max(logicalWa.Left, logicalWa.Right - w));
        y = Math.Clamp(y, logicalWa.Top, Math.Max(logicalWa.Top, logicalWa.Bottom - h));
        _focusForm.Location = new Point(x, y);
        PushFocusState();
        _focusForm.Show();
        _focusForm.Activate();
    }

    private void OnFocusMessage(string type, JsonElement root)
    {
        switch (type)
        {
            case "focus-get-state":
                PushFocusState();
                break;
            case "focus-toggle":
                _focusTimer?.Toggle();
                break;
            case "focus-reset":
                _focusTimer?.Reset();
                break;
            case "focus-skip":
                _focusTimer?.Skip();
                break;
            case "focus-preset":
                _focusTimer?.SetPreset(root.GetProperty("presetId").GetString() ?? "25-5");
                break;
            case "focus-custom-duration":
                _focusTimer?.SetCustom(
                    Prop(root, "minutes", 25),
                    Prop(root, "breakMinutes", 5),
                    Prop(root, "longBreakMinutes", 15),
                    Prop(root, "rounds", 4));
                break;
            case "focus-drag":
                if (_focusForm == null) break;
                MoveFocusFormTo(
                    _focusForm.Location.X + root.GetProperty("dx").GetInt32(),
                    _focusForm.Location.Y + root.GetProperty("dy").GetInt32());
                break;
            case "focus-close":
                _focusForm?.Hide();
                break;
        }
    }

    private static int Prop(JsonElement root, string name, int fallback) =>
        root.TryGetProperty(name, out var el) ? el.GetInt32() : fallback;

    private void MoveFocusFormTo(int x, int y)
    {
        if (_focusForm == null) return;
        var scale = DeviceDpi / 96f;
        var wa = Screen.PrimaryScreen?.WorkingArea ?? Rectangle.Empty;
        var logicalWa = new Rectangle(
            (int)Math.Round(wa.X / scale),
            (int)Math.Round(wa.Y / scale),
            (int)Math.Round(wa.Width / scale),
            (int)Math.Round(wa.Height / scale));
        x = Math.Clamp(x, logicalWa.Left, Math.Max(logicalWa.Left, logicalWa.Right - _focusForm.Width));
        y = Math.Clamp(y, logicalWa.Top, Math.Max(logicalWa.Top, logicalWa.Bottom - _focusForm.Height));
        _focusForm.Location = new Point(x, y);
    }

    private void StoreMenuSizes(JsonElement root)
    {
        if (_menuForm == null) return;
        var innerWidth = root.GetProperty("innerWidth").GetInt32();
        if (innerWidth <= 0) return;
        _collapsedSize = MenuSize(root.GetProperty("collapsed"));
        _styleSize = MenuSize(root.GetProperty("style"));
        _settingsSize = MenuSize(root.GetProperty("settings"));
        _bothSize = MenuSize(root.GetProperty("both"));
    }

    private static Size MenuSize(JsonElement o)
    {
        var w = o.GetProperty("w").GetInt32();
        var h = o.GetProperty("h").GetInt32();
        var right = o.TryGetProperty("right", out var r) ? r.GetInt32() : w;
        var contentW = Math.Max(w, right);
        return new Size(
            Math.Clamp(contentW + 12, 150, 1000),
            Math.Clamp(h + 12, 80, 700));
    }

    private void ResizeMenuToFit(JsonElement root)
    {
        if (_menuForm == null) return;
        var cssWidth = root.GetProperty("cssWidth").GetInt32();
        var cssHeight = root.GetProperty("cssHeight").GetInt32();
        var innerWidth = root.GetProperty("innerWidth").GetInt32();
        if (innerWidth <= 0) return;
        // The WebView renders 1 CSS px = 1 logical px in this DPI-unaware host.
        // Do not derive a live ratio from formWidth/innerWidth: right after a
        // window resize the browser's innerWidth lags behind, which made the
        // menu grow out of control. A fixed 1:1 conversion is stable.
        // offsetWidth can exclude a classic vertical scrollbar; use the
        // element's border-box right edge when it is larger so the window
        // never clips the menu's right side.
        var contentWidth = cssWidth;
        if (root.TryGetProperty("menuRect", out var mr))
        {
            var rectRight = mr.GetProperty("right").GetInt32() - mr.GetProperty("left").GetInt32();
            if (rectRight > contentWidth) contentWidth = rectRight;
        }
        var expanded = root.TryGetProperty("expanded", out var exp) && exp.GetBoolean();
        var newWidth = Math.Clamp(contentWidth + 12, 150, 1000);
        var newHeight = Math.Clamp(cssHeight + 12, 80, 700);
        // While a submenu is open, only grow the window; shrink back to the
        // collapsed size when the last submenu closes (keeps expand smooth).
        if (expanded)
        {
            newWidth = Math.Max(newWidth, _menuForm.Width);
            newHeight = Math.Max(newHeight, _menuForm.Height);
        }
        _menuForm.Size = new Size(newWidth, newHeight);
        Log($"fit css={cssWidth}x{cssHeight} inner={innerWidth} -> {newWidth}x{newHeight}");
        PositionPetMenu();
    }

    private void MovePetToEdge(string? pos)
    {
        var wa = Screen.PrimaryScreen?.WorkingArea ?? Rectangle.Empty;
        var s = DeviceDpi / 96f;
        var logicalWa = new Rectangle(
            (int)Math.Round(wa.X / s),
            (int)Math.Round(wa.Y / s),
            (int)Math.Round(wa.Width / s),
            (int)Math.Round(wa.Height / s));
        switch (pos)
        {
            case "tl": Location = new Point(logicalWa.Left, logicalWa.Top); break;
            case "tr": Location = new Point(logicalWa.Right - Width, logicalWa.Top); break;
            case "bl": Location = new Point(logicalWa.Left, logicalWa.Bottom - Height); break;
            case "br": Location = new Point(logicalWa.Right - Width, logicalWa.Bottom - Height); break;
        }
    }

    private static void SaveConfig(int size, string color)
    {
        try
        {
            Directory.CreateDirectory(ConfigDir);
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(new { size, color }));
        }
        catch
        {
        }
    }

    private static string LoadColor()
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(ConfigPath));
            var color = doc.RootElement.GetProperty("color").GetString() ?? "#2f86ed";
            // Pure black is used as the transparency key by the DWM-glass
            // window, so a pure-black pet would be invisible. Migrate it to
            // the visible dark shade used by the color palette.
            return string.Equals(color, "#000000", StringComparison.OrdinalIgnoreCase)
                ? "#2b2b2b"
                : color;
        }
        catch
        {
            return "#2f86ed";
        }
    }

    private static string AutostartTarget => Path.Combine(AppContext.BaseDirectory, "Bootstrap.exe");

    private static bool IsAutostartEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyName);
            return (key?.GetValue(RunValueName) as string) == AutostartTarget;
        }
        catch
        {
            return false;
        }
    }

    private void SetAutostart(bool enable)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKeyName);
            if (enable)
                key.SetValue(RunValueName, "\"" + AutostartTarget + "\"");
            else
                key.DeleteValue(RunValueName, false);
            Post(new { type = "autostart", enabled = IsAutostartEnabled() });
        }
        catch
        {
        }
    }

    private void CreateDesktopShortcut()
    {
        try
        {
            var desktop = DesktopPath();
            var shortcutPath = Path.Combine(desktop, "小鹞 WhistleBot.lnk");
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic shell = Activator.CreateInstance(shellType);
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = Path.Combine(AppContext.BaseDirectory, "Bootstrap.exe");
            shortcut.WorkingDirectory = AppContext.BaseDirectory;
            shortcut.Description = "小鹞 WhistleBot";
            shortcut.Save();
            Post(new { type = "toast", text = "已创建桌面快捷方式" });
        }
        catch (Exception ex)
        {
            Post(new { type = "toast", text = "创建快捷方式失败" });
        }
    }

    private void OpenAbout()
    {
        try
        {
            Process.Start(new ProcessStartInfo("https://ainepadma.cn/soundflyinggallery/sound/desktop-pet/")
            {
                UseShellExecute = true
            });
        }
        catch
        {
        }
    }

    private static string DesktopPath()
    {
        var d = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (!string.IsNullOrEmpty(d) && Directory.Exists(d))
            return d;
        var fallback = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Desktop");
        return Directory.Exists(fallback) ? fallback : d;
    }

    private void Uninstall()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKeyName);
            key.DeleteValue(RunValueName, false);
        }
        catch
        {
        }
        try
        {
            File.Delete(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "小鹞 WhistleBot.lnk"));
        }
        catch
        {
        }
        try
        {
            SaveConfig(280, "#2f86ed");
        }
        catch
        {
        }
        var dir = AppContext.BaseDirectory;
        var script = $"timeout /t 3 /nobreak >nul & rmdir /s /q \"{dir}\"";
        try
        {
            Process.Start(new ProcessStartInfo("cmd.exe", $"/c {script}")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            });
        }
        catch
        {
        }
        Close();
    }

    private void ResizePet(int size)
    {
        size = Math.Clamp(size, 180, 420);
        Size = new Size(size, size + NoteHeadroom);
        var wa = Screen.PrimaryScreen?.WorkingArea ?? Rectangle.Empty;
        if (wa.Width > 0)
        {
            var s = DeviceDpi / 96f;
            var logicalW = (int)Math.Round(wa.Width / s);
            var logicalH = (int)Math.Round(wa.Height / s);
            Location = new Point(
                Math.Clamp(Location.X, 0, Math.Max(0, logicalW - size)),
                Math.Clamp(Location.Y, 0, Math.Max(0, logicalH - size)));
        }
        ApplyPetRegion();
        SaveConfig(size, _petColor);
        Post(new { type = "size", size });
        if (_menuForm != null && _menuForm.Visible) PositionPetMenu();
    }

    private static Icon MakeIcon()
    {
        try
        {
            // Use the whistle icon embedded in the executable (tray + windows).
            var exePath = Environment.ProcessPath;
            if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
            {
                var icon = Icon.ExtractAssociatedIcon(exePath);
                if (icon != null) return icon;
            }
        }
        catch
        {
        }
        using var bmp = new Bitmap(16, 16);
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            using var brush = new SolidBrush(Color.FromArgb(47, 134, 237));
            g.FillEllipse(brush, 2, 2, 12, 12);
        }
        return Icon.FromHandle(bmp.GetHicon());
    }
}
