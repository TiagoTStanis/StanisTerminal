using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;

// Hospeda a janela do servidor X dentro da área de abas do aplicativo.
class EmbedHost {
    delegate bool EnumProc(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr hwnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    static void Main(string[] args) {
        var json = new JavaScriptSerializer();
        try {
            SetProcessDpiAwarenessContext(new IntPtr(-4));
            var parent = new IntPtr(long.Parse(args[0])); uint target = uint.Parse(args[1]); IntPtr child = IntPtr.Zero;
            for (int i = 0; i < 150 && child == IntPtr.Zero; i++) {
                EnumWindows(delegate(IntPtr hwnd, IntPtr data) { uint pid; GetWindowThreadProcessId(hwnd, out pid); if (pid == target && IsWindowVisible(hwnd)) { child = hwnd; return false; } return true; }, IntPtr.Zero);
                if (child == IntPtr.Zero) Thread.Sleep(100);
            }
            if (child == IntPtr.Zero) throw new Exception("A janela do servidor X não foi encontrada.");
            ShowWindow(child, 0);
            SetWindowLong(child, -16, (GetWindowLong(child, -16) & unchecked((int)~0x80CF0000)) | 0x40000000);
            SetParent(child, parent);
            Console.WriteLine(json.Serialize(new { type = "ready", message = "Servidor X11 incorporado" })); Console.Out.Flush();
            string line;
            while ((line = Console.ReadLine()) != null) {
                var p = json.Deserialize<Dictionary<string, object>>(line);
                if (Convert.ToString(p["cmd"]) == "close") break;
                if (Convert.ToString(p["cmd"]) == "bounds") {
                    if (!Convert.ToBoolean(p["visible"])) ShowWindow(child, 0);
                    else { MoveWindow(child, Convert.ToInt32(p["x"]), Convert.ToInt32(p["y"]), Convert.ToInt32(p["width"]), Convert.ToInt32(p["height"]), true); ShowWindow(child, 5); }
                }
            }
        } catch (Exception ex) { Console.WriteLine(json.Serialize(new { type = "error", message = ex.Message })); }
    }
}
