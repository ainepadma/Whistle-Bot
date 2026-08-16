using System.Diagnostics;
using System.Runtime.InteropServices;

namespace PetApp;

/// <summary>Windows input helpers: system-wide idle time + low-level keyboard hook.</summary>
internal static class NativeInput
{
    [StructLayout(LayoutKind.Sequential)]
    private struct LastInputInfo
    {
        public uint CbSize;
        public uint DwTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KbdLlHookStruct
    {
        public uint VkCode;
        public uint ScanCode;
        public uint Flags;
        public uint Time;
        public IntPtr DwExtraInfo;
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LastInputInfo plii);

    [DllImport("kernel32.dll")]
    private static extern ulong GetTickCount64();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);

    private static LowLevelKeyboardProc? _proc;
    private static IntPtr _hook;

    public static event Action<uint>? KeyDown;

    /// <summary>Seconds since the last global mouse/keyboard input anywhere on the system.</summary>
    public static uint GetIdleSeconds()
    {
        var info = new LastInputInfo { CbSize = (uint)Marshal.SizeOf<LastInputInfo>() };
        if (!GetLastInputInfo(ref info))
            return 0;
        return (uint)((GetTickCount64() - info.DwTime) / 1000ul);
    }

    public static void StartKeyboardHook()
    {
        if (_hook != IntPtr.Zero)
            return;
        _proc = (nCode, wParam, lParam) =>
        {
            if (nCode >= 0 && (wParam == (IntPtr)WmKeyDown || wParam == (IntPtr)WmSysKeyDown))
            {
                var info = Marshal.PtrToStructure<KbdLlHookStruct>(lParam);
                KeyDown?.Invoke(info.VkCode);
            }
            return CallNextHookEx(_hook, nCode, wParam, lParam);
        };
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule;
        _hook = SetWindowsHookEx(WhKeyboardLl, _proc, GetModuleHandle(module?.ModuleName), 0);
    }

    public static void StopKeyboardHook()
    {
        if (_hook != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }
}
