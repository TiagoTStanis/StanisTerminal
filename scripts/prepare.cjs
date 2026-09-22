const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'src/ui/vendor'), { recursive: true });
fs.copyFileSync(require.resolve('@xterm/xterm/css/xterm.css'), path.join(root, 'src/ui/vendor/xterm.css'));
esbuild.buildSync({ entryPoints: [path.join(root, 'src/ui/renderer.js')], bundle: true, format: 'esm', outfile: path.join(root, 'src/ui/app.js'), platform: 'browser', target: 'chrome140', minify: false, define: { 'process.env.FENGARICONF': 'undefined', 'process.versions.node': '"0"' }, alias: { fs: path.join(root, 'scripts/browser-stub.cjs'), os: path.join(root, 'scripts/browser-stub.cjs'), 'readline-sync': path.join(root, 'scripts/browser-stub.cjs'), tmp: path.join(root, 'scripts/browser-stub.cjs'), child_process: path.join(root, 'scripts/browser-stub.cjs'), path: path.join(root, 'scripts/browser-stub.cjs') } });
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/icon.ps1')], { stdio: 'inherit', windowsHide: true });
  const csc = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(csc, ['/nologo', '/target:exe', '/platform:x64', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Web.Extensions.dll', '/r:Microsoft.CSharp.dll', '/out:' + path.join(root, 'src/native/RdpHost.exe'), path.join(root, 'src/native/RdpHost.cs')], { stdio: 'inherit', windowsHide: true });
  execFileSync(csc, ['/nologo', '/target:exe', '/platform:x64', '/r:System.Web.Extensions.dll', '/out:' + path.join(root, 'src/native/EmbedHost.exe'), path.join(root, 'src/native/EmbedHost.cs')], { stdio: 'inherit', windowsHide: true });
}
console.log('Interface e componente RDP compilados.');
