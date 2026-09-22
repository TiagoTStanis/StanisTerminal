using System;
using System.IO;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Collections.Generic;

// O controle oficial do Windows fica como filho da janela principal, sem mstsc externo.
class RdpControl : AxHost {
    public RdpControl() : base("8B918B82-7985-4C24-89DF-C33AD2BBFBCD") {}
    public object Com { get { return GetOcx(); } }
}
class RdpHost : Form {
    [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr hwnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly RdpControl rdp = new RdpControl();
    IntPtr parent;
    System.Windows.Forms.Timer connectWatch;
    int connectElapsedMs; bool wasConnecting;
    public RdpHost(long parentHandle) {
        parent = new IntPtr(parentHandle);
        FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual; Size = new Size(800, 500);
        BackColor = Color.FromArgb(15, 20, 28);
        ((System.ComponentModel.ISupportInitialize)rdp).BeginInit();
        rdp.Dock = DockStyle.Fill; Controls.Add(rdp);
        ((System.ComponentModel.ISupportInitialize)rdp).EndInit();
        Shown += delegate {
            SetWindowLong(Handle, -16, (GetWindowLong(Handle, -16) & unchecked((int)~0x80000000)) | 0x40000000);
            SetParent(Handle, parent); Hide();
            try { var control = rdp.Com; Emit("ready", "Controle RDP carregado"); }
            catch (Exception ex) { Emit("error", ex.Message); Close(); return; }
            var input = new Thread(ReadCommands); input.IsBackground = true; input.Start();
        };
        FormClosing += delegate { if (connectWatch != null) connectWatch.Stop(); try { dynamic c = rdp.Com; if (c.Connected != 0) c.Disconnect(); } catch {} };
    }
    void Emit(string type, string message) { Console.WriteLine(json.Serialize(new { type = type, message = message })); Console.Out.Flush(); }
    void ReadCommands() {
        string line;
        try {
            while ((line = Console.ReadLine()) != null) {
                var message = json.Deserialize<Dictionary<string, object>>(line);
                BeginInvoke(new Action(delegate { Command(message); }));
            }
            BeginInvoke(new Action(Close));
        } catch { try { BeginInvoke(new Action(Close)); } catch {} }
    }
    void Command(Dictionary<string, object> p) {
        try {
            string cmd = Convert.ToString(p["cmd"]);
            if (cmd == "close") { Close(); return; }
            if (cmd == "bounds") {
                if (!Convert.ToBoolean(p["visible"])) { Hide(); return; }
                MoveWindow(Handle, Convert.ToInt32(p["x"]), Convert.ToInt32(p["y"]), Convert.ToInt32(p["width"]), Convert.ToInt32(p["height"]), true);
                Show(); return;
            }
            dynamic c = rdp.Com;
            if (cmd == "connect") {
                c.Server = Convert.ToString(p["host"]); c.UserName = Convert.ToString(p["username"]);
                c.DesktopWidth = 1280; c.DesktopHeight = 800; c.ColorDepth = 32;
                dynamic advanced = c.AdvancedSettings8;
                advanced.RDPPort = Convert.ToInt32(p["port"]);
                advanced.EnableCredSspSupport = true;
                // Nível 2: tenta autenticar o servidor, mas permite prosseguir (com aviso) se o certificado
                // não for confiável — a maioria dos servidores domésticos/administrativos usa certificado
                // autoassinado. Nível 1 (exigir sucesso) travava a conexão sem aviso nesses casos.
                advanced.AuthenticationLevel = 2;
                advanced.SmartSizing = true;
                advanced.RedirectClipboard = false;
                advanced.RedirectDrives = false;
                advanced.ClearTextPassword = Convert.ToString(p["password"]);
                c.Connect(); Emit("connecting", "Conectando ao servidor RDP");
                // O controle não expõe eventos aqui (sem wrapper de interop gerado), então observamos
                // Connected por polling: sem isso, uma falha silenciosa (ex.: autenticação recusada)
                // deixava a aba travada sem nenhum aviso para o usuário.
                if (connectWatch != null) connectWatch.Stop();
                connectElapsedMs = 0; wasConnecting = false;
                connectWatch = new System.Windows.Forms.Timer(); connectWatch.Interval = 400;
                connectWatch.Tick += delegate {
                    connectElapsedMs += 400;
                    int state; try { state = Convert.ToInt32(c.Connected); } catch { state = -1; }
                    if (state == 1) { connectWatch.Stop(); Emit("connected", "Conectado por RDP."); return; }
                    if (state == 2) wasConnecting = true;
                    else if (state == 0 && wasConnecting) {
                        connectWatch.Stop();
                        Emit("error", "A conexão RDP foi recusada ou encerrada pelo servidor. Verifique usuário/senha e se a Área de Trabalho Remota está habilitada.");
                        Close(); return;
                    }
                    if (connectElapsedMs >= 25000) {
                        connectWatch.Stop();
                        Emit("error", "Tempo limite ao conectar por RDP. Verifique o endereço, a porta e a rede até o servidor.");
                        Close();
                    }
                };
                connectWatch.Start();
            }
        } catch (Exception ex) { Emit("error", ex.Message); }
    }
    [STAThread] static void Main(string[] args) {
        try {
            SetProcessDpiAwarenessContext(new IntPtr(-4));
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new RdpHost(long.Parse(args[0])));
        } catch (Exception ex) { Console.WriteLine(new JavaScriptSerializer().Serialize(new { type = "error", message = ex.Message })); }
    }
}
