// Servidor FTP mínimo usado somente em testes em 127.0.0.1.
const net = require('node:net');
const { once } = require('node:events');
async function createFTP() {
  const files = new Map([['hello.txt', Buffer.from('FTP de laboratório')]]);
  const sockets = new Set(), passive = new Set();
  const track = socket => { sockets.add(socket); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket)); return socket; };
  const server = net.createServer(control => {
    track(control); control.setEncoding('utf8'); let pending = '', dataSocket;
    const send = message => control.write(message + '\r\n');
    send('220 Laboratório FTP');
    async function command(line) {
      const [verb, ...words] = line.split(' '); const argument = words.join(' '); const name = argument.replace(/^\//, '');
      if (verb === 'USER') return send('331 Password required');
      if (verb === 'PASS') return send('230 Logged in');
      if (verb === 'FEAT') return send('211 No features');
      if (['TYPE', 'OPTS', 'CWD'].includes(verb)) return send('200 OK');
      if (verb === 'PWD') return send('257 "/"');
      if (verb === 'EPSV') {
        const listener = net.createServer(); passive.add(listener);
        dataSocket = once(listener, 'connection').then(([socket]) => { track(socket); listener.close(); passive.delete(listener); return socket; });
        listener.listen(0, '127.0.0.1'); await once(listener, 'listening'); return send(`229 Entering Extended Passive Mode (|||${listener.address().port}|)`);
      }
      if (['LIST', 'RETR', 'STOR'].includes(verb)) {
        send('150 Opening data connection'); const socket = await dataSocket;
        if (verb === 'STOR') {
          const chunks = []; socket.on('data', data => chunks.push(data)); await once(socket, 'end'); files.set(name, Buffer.concat(chunks)); socket.end();
        } else {
          const bytes = verb === 'LIST' ? Buffer.from([...files].map(([file, data]) => `-rw-r--r-- 1 user group ${data.length} Jan 01 2026 ${file}\r\n`).join('')) : files.get(name);
          socket.end(bytes); await once(socket, 'close');
        }
        return send('226 Transfer complete');
      }
      if (verb === 'SIZE') return send(files.has(name) ? '213 ' + files.get(name).length : '550 Missing');
      if (verb === 'QUIT') { send('221 Goodbye'); return control.end(); }
      send('502 Not implemented');
    }
    let chain = Promise.resolve();
    control.on('data', chunk => {
      pending += chunk;
      while (pending.includes('\r\n')) {
        const boundary = pending.indexOf('\r\n'), line = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        chain = chain.then(() => command(line)).catch(() => control.destroy());
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { port: server.address().port, close() { for (const socket of sockets) socket.destroy(); for (const listener of passive) listener.close(); server.close(); } };
}
module.exports = { createFTP };
