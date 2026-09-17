// ส่งเฟรม inventory ของ SID แล้ว dump ทุก byte ที่ตอบกลับมาแบบดิบ ๆ เพื่อดูโครงเฟรมจริงของ
// เครื่องรุ่นนี้ (R2000 4 พอร์ต) ว่าตรงกับ parseFrames() เดิมไหม
//   node scripts/reader-raw.js 192.168.1.250 27011
import net from 'net';

const ip = process.argv[2] || '192.168.1.250';
const port = Number(process.argv[3] || 27011);

function crc16(bytes) {
  let crc = 0xffff;
  for (let b of bytes) {
    for (let i = 0; i < 8; i += 1) {
      const bit = (b ^ crc) & 0x01;
      crc >>= 1;
      if (bit) crc ^= 0x8408;
      b >>= 1;
    }
  }
  return crc & 0xffff;
}
function frame(cmd, data) {
  const len = 1 + 1 + data.length + 2;
  const body = Buffer.concat([Buffer.from([len, 0x00, cmd]), data]);
  const c = crc16(body);
  return Buffer.concat([body, Buffer.from([c & 0xff, (c >> 8) & 0xff])]);
}

const inv = frame(0x01, Buffer.from([0x04, 0x00]));
const s = net.connect({ host: ip, port }, () => {
  console.log('ต่อสำเร็จ, ส่ง:', inv.toString('hex'));
  s.write(inv);
});
let chunks = [];
s.on('data', (d) => {
  chunks.push(d);
  console.log(`<< ${d.length}B  ${d.toString('hex').replace(/(..)/g, '$1 ').trim()}`);
});
s.on('error', (e) => console.error('error:', e.message));
setTimeout(() => {
  const all = Buffer.concat(chunks);
  console.log(`\nรวม ${all.length} byte:\n${all.toString('hex').replace(/(..)/g, '$1 ').trim()}`);
  s.destroy();
}, 3000);
