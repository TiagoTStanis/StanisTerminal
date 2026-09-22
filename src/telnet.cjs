// Negociação mínima RFC 854: preserva estados entre pacotes TCP fragmentados.
class Telnet {
  constructor(send) { this.send = send; this.state = 'data'; this.command = 0; }
  decode(buffer) {
    const output = [];
    for (const byte of buffer) {
      if (this.state === 'data') { if (byte === 255) this.state = 'iac'; else output.push(byte); }
      else if (this.state === 'iac') {
        if (byte === 255) { output.push(byte); this.state = 'data'; }
        else if (byte >= 251 && byte <= 254) { this.command = byte; this.state = 'option'; }
        else this.state = byte === 250 ? 'sub' : 'data';
      } else if (this.state === 'option') {
        if (this.command === 251) this.send(Buffer.from([255, [1, 3].includes(byte) ? 253 : 254, byte]));
        if (this.command === 253) this.send(Buffer.from([255, byte === 3 ? 251 : 252, byte]));
        this.state = 'data';
      } else if (this.state === 'sub') { if (byte === 255) this.state = 'sub-iac'; }
      else if (this.state === 'sub-iac') this.state = byte === 240 ? 'data' : 'sub';
    }
    return Buffer.from(output);
  }
  encode(value) { return Buffer.from([...Buffer.from(value)].flatMap(x => x === 255 ? [255, 255] : [x])); }
}
module.exports = { Telnet };
