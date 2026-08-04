$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public static class KeyHook {
    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    private static IntPtr _hook = IntPtr.Zero;
    private static LowLevelKeyboardProc _proc;
    private static readonly object _lock = new object();
    private static readonly List<double> _events = new List<double>();
    private static readonly System.Diagnostics.Stopwatch _sw = new System.Diagnostics.Stopwatch();

    public static bool Start() {
        if (_hook != IntPtr.Zero) return true;
        _proc = Callback;
        _sw.Start();
        _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
        return _hook != IntPtr.Zero;
    }

    public static void Stop() {
        if (_hook != IntPtr.Zero) {
            UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }

    public static double GetSpeed() {
        double now = _sw.Elapsed.TotalMilliseconds;
        lock (_lock) {
            while (_events.Count > 0 && _events[0] < now - 2000) {
                _events.RemoveAt(0);
            }
            return Math.Round(_events.Count / 2.0, 2);
        }
    }

    private static IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            long msg = wParam.ToInt64();
            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                lock (_lock) {
                    _events.Add(_sw.Elapsed.TotalMilliseconds);
                }
            }
        }
        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static void Pump() {
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
    }

    public static void RunPump() {
        Thread t = new Thread(new ThreadStart(Pump));
        t.SetApartmentState(ApartmentState.STA);
        t.IsBackground = true;
        t.Start();
    }
}
'@

if (-not [KeyHook]::Start()) {
    Write-Output '{"error": "hook install failed"}'
    [Console]::Out.Flush()
    exit 1
}

[KeyHook]::RunPump()

while ($true) {
    $speed = [KeyHook]::GetSpeed()
    Write-Output ('{{"speed": {0}}}' -f $speed)
    [Console]::Out.Flush()
    Start-Sleep -Milliseconds 100
}
