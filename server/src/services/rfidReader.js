import net from 'net';

// Wire protocol ของ SID-U881-8dbi (SDK: SDK-SID-u881-8dbi) แกะได้จากการดักแพ็กเก็ตจริงระหว่าง
// โปรแกรม demo (SID_U861 CSharp) คุยกับเครื่องผ่าน TCP/IP (คนละโปรโตคอลกับที่ระบุใน .doc ของ SDK
// ซึ่งมีแค่ signature ของฟังก์ชัน DLL ไม่มีระดับ byte) โครงเฟรม:
//   [Len(1)] [Adr(1)] [Cmd(1)] [Data(N)] [CRC16 LSB] [CRC16 MSB]
// โดย Len = จำนวน byte ที่เหลือหลังจากตัวมันเอง (Adr+Cmd+Data+CRC) และ CRC16 คำนวณจากทุก byte
// ในเฟรมรวม Len ด้วย (CRC-16/X-25: poly 0x1021 reflected แบบ MSB-first shift, init 0xFFFF)
const READER_ADDR = 0x00;
const CMD_INVENTORY = 0x01;
// Data ของคำสั่ง inventory ที่ demo ส่งจริงตอนกด "Query Tag" — ยังไม่ทราบความหมายของแต่ละ byte
// ชัดเจน (อาจเป็น Q-value/session) จึง replay ค่าที่ยืนยันแล้วว่าใช้งานได้จริงไปก่อน
const INVENTORY_DATA = Buffer.from([0x04, 0x00]);

// SetPowerDbm — ยืนยันจากการ disassemble SID_U861.dll (export SetPowerDbm @ RVA 0x54c0):
//   เฟรม = [Len=0x05] [Adr] [Cmd=0x2F] [powerDbm 1 byte] [CRC16 lo] [CRC16 hi]
//   powerDbm range 0-18 (ส่ง byte ตรงๆ ไม่ต้อง save flash, มีผลทันที) เครื่องตอบ status ที่ byte[3]
// (env RFID_SET_POWER_CMD ไว้ override เผื่อรุ่นอื่น — ปกติไม่ต้องตั้ง)
const CMD_SET_POWER = process.env.RFID_SET_POWER_CMD
  ? parseInt(process.env.RFID_SET_POWER_CMD, 16)
  : 0x2f;

function crc16(bytes) {
  let crc = 0xffff;
  for (let byte of bytes) {
    for (let i = 0; i < 8; i += 1) {
      const bit = (byte ^ crc) & 0x01;
      crc >>= 1;
      if (bit) crc ^= 0x8408;
      byte >>= 1;
    }
  }
  return crc & 0xffff;
}

function buildFrame(cmd, data = Buffer.alloc(0), adr = READER_ADDR) {
  const len = 1 + 1 + data.length + 2; // Adr + Cmd + Data + CRC(2)
  const withoutCrc = Buffer.concat([Buffer.from([len, adr, cmd]), data]);
  const crc = crc16(withoutCrc);
  return Buffer.concat([withoutCrc, Buffer.from([crc & 0xff, (crc >> 8) & 0xff])]);
}

// แกะรายการแท็กจาก buffer ที่ต่อกันมาหลายเฟรม (แต่ละแท็ก 1 เฟรมแยกกัน ไม่ได้รวมเป็นก้อนเดียว)
// เครื่องอ่านคนละรุ่นมี header ก่อน EPCLen ยาวไม่เท่ากัน จึงลองทีละ layout เอาอันที่ "ตรงเป๊ะ"
// (EPCLen ต้องสอดคล้องกับ Len และมี RSSI(1)+CRC(2) ต่อท้ายพอดีถึงท้ายเฟรม)
//   R2000 4 พอร์ต (192.168.1.250): Len,Adr,Cmd,Ant,b4,b5,EPCLen,EPC,RSSI,CRC16  → EPCLen ที่ offset 6, Len = EPCLen+9
//     ตัวอย่าง: 15 00 01 | 03 01 01 | 0C | E2 80 68 90 00 00 00 00 00 00 07 57 | 4B | 9C 90
//   คีออสตรวจสอบ (192.168.1.190): Len,Adr,Cmd,b3,b4,EPCLen,EPC,RSSI,CRC16       → EPCLen ที่ offset 5, Len = EPCLen+8
//     ตัวอย่าง: 14 00 01 | 03 01 | 0C | E2 80 69 15 00 00 50 20 7D 83 70 35 | 69 | 06 64
// เฟรมปิดท้าย (สรุปผล ไม่มี EPC): Len เล็ก (6-7), Cmd=0x01, ตามด้วย XX 00 CRC — len < 10 เลยถูกข้าม
const TAG_FRAME_LAYOUTS = [
  { epcLenOffset: 6, nonEpcBytes: 9 },
  { epcLenOffset: 5, nonEpcBytes: 8 },
];

function parseFrames(buffer) {
  const epcs = [];
  let offset = 0;
  while (offset < buffer.length) {
    const len = buffer[offset];
    const frameEnd = offset + 1 + len;
    if (frameEnd > buffer.length) break; // เฟรมยังมาไม่ครบ รอรอบถัดไป

    const cmd = buffer[offset + 2];
    if (cmd === CMD_INVENTORY && len >= 10) {
      const ant = buffer[offset + 3];
      for (const { epcLenOffset, nonEpcBytes } of TAG_FRAME_LAYOUTS) {
        const epcLen = buffer[offset + epcLenOffset];
        const epcStart = offset + epcLenOffset + 1;
        const epcEnd = epcStart + epcLen;
        if (epcLen > 0 && epcLen === len - nonEpcBytes && epcEnd + 3 === frameEnd) {
          epcs.push({
            epc: buffer.subarray(epcStart, epcEnd).toString('hex').toUpperCase(),
            rssi: buffer[epcEnd],
            ant,
          });
          break;
        }
      }
    }
    offset = frameEnd;
  }
  return epcs;
}

// ค่า default ปรับได้ผ่าน env เผื่อจูนหน้างานโดยไม่ต้องแก้โค้ด
// idleTimeout   = เงียบนานเท่านี้ = เครื่องตอบ inventory รอบนั้นจบแล้ว (ค่อยยิงรอบถัดไป ไม่ยิงทับ
//                 ตอนเครื่องกำลังตอบ ซึ่งเป็นสาเหตุที่ทำให้บางรุ่นหยุดตอบไปเลย)
// stableRounds  = ยิง inventory ซ้ำเรื่อยๆ จนกว่าจะไม่เจอ EPC ใหม่ติดกันครบกี่รอบ ถึงจะถือว่า
//                 "อ่านครบแล้ว" แล้วจบ — เผื่อกรณีเข็นรถเข็นผ้าผ่านเครื่องช้าๆ ต้องอ่านจนสุดคัน
// maxWait/maxRounds = เพดานกันค้าง ถ้าเครื่องสตรีมไม่หยุด หรือเจอแท็กใหม่เรื่อยๆ ไม่จบสักที
const DEFAULT_IDLE_TIMEOUT_MS = Number(process.env.RFID_IDLE_TIMEOUT_MS) || 800;
const DEFAULT_STABLE_ROUNDS = Number(process.env.RFID_STABLE_ROUNDS) || 3;
const DEFAULT_MAX_WAIT_MS = Number(process.env.RFID_MAX_WAIT_MS) || 15000;
const DEFAULT_MAX_ROUNDS = Number(process.env.RFID_MAX_ROUNDS) || 50;

// RFID_DEBUG=1 -> log ทุกขั้นตอนตอนคุยกับเครื่องอ่าน (ต่อ/ส่ง/รับ byte ดิบ/สรุปผล) ลง server log
// ใช้ debug ตอน bring-up เครื่องใหม่ว่า "ต่อไม่ติด" หรือ "ต่อติดแต่เฟรมไม่ตรงรูปแบบที่ parse ได้"
const DEBUG = process.env.RFID_DEBUG === '1' || process.env.RFID_DEBUG === 'true';
const hex = (buf) => buf.toString('hex').replace(/(..)/g, '$1 ').trim();
const dbg = (...args) => {
  if (DEBUG) console.log('[rfid-reader]', ...args);
};

/**
 * เชื่อมต่อไปที่เครื่องอ่าน RFID ผ่าน TCP/IP แล้วสั่ง inventory ซ้ำเป็นรอบๆ จนกว่าจะ "อ่านครบ"
 * (ไม่เจอ EPC ใหม่ติดกันครบ stableRounds รอบ) หรือชนเพดานเวลา/จำนวนรอบ แล้วปิดการเชื่อมต่อ
 *
 * ยิงรอบถัดไป "หลังเครื่องตอบรอบเดิมจบ" เสมอ (เงียบครบ idleTimeoutMs) ไม่ยิงทับตอนเครื่องกำลังตอบ
 * — ออกแบบให้รองรับเคสเข็นรถเข็นผ้าที่ติดแท็กผ่านเครื่องช้าๆ ต้องอ่านจนสุดคันก่อนจบ
 */
export function queryTags({
  ip,
  port,
  connectTimeoutMs = 5000,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  stableRounds = DEFAULT_STABLE_ROUNDS,
  maxRounds = DEFAULT_MAX_ROUNDS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  powerDbm, // 0-18: สั่งตั้งกำลังส่งก่อน inventory | undefined = ไม่แตะ ใช้ค่าเดิมในเครื่อง
}) {
  const inventoryFrame = buildFrame(CMD_INVENTORY, INVENTORY_DATA);
  const setPower = powerDbm >= 0 && powerDbm <= 18 ? Math.round(powerDbm) : null;
  const setPowerFrame = setPower !== null ? buildFrame(CMD_SET_POWER, Buffer.from([setPower])) : null;
  dbg(
    `ต่อ ${ip}:${port} | อ่านจนนิ่ง ${stableRounds} รอบ (idle ${idleTimeoutMs}ms) เพดาน ${maxRounds} รอบ/${maxWaitMs}ms` +
      (setPowerFrame ? ` | ตั้งกำลัง ${setPower}dBm: ${hex(setPowerFrame)}` : '') +
      ` | inv ${hex(inventoryFrame)}`
  );

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let rxBytes = 0; // นับ byte ดิบทั้งหมดที่รับมา ไว้แยก "ต่อไม่ติด" ออกจาก "ต่อติดแต่ parse ไม่ได้"
    let roundsSent = 0;
    let stableStreak = 0; // จำนวนรอบล่าสุดที่ไม่เจอ EPC ใหม่เลย
    const found = new Map(); // epc -> { epc, rssi, ant } (เก็บ rssi ที่แรงสุดที่เจอ)
    let idleTimer = null;
    let maxTimer = null;
    let settled = false;

    // เก็บ EPC จาก buffer เข้าชุดผลรวม, คืนจำนวน EPC "ใหม่" ที่เพิ่งเจอในรอบนี้
    const collect = () => {
      let fresh = 0;
      for (const tag of parseFrames(buffer)) {
        const prev = found.get(tag.epc);
        if (!prev) fresh += 1;
        if (!prev || tag.rssi > prev.rssi) found.set(tag.epc, tag);
      }
      buffer = Buffer.alloc(0);
      return fresh;
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      socket.destroy();
      if (error) {
        dbg(`จบแบบ error: ${error.message} (รับ ${rxBytes} byte)`);
        reject(error);
        return;
      }
      collect();
      const epcs = [...found.values()];
      dbg(
        `จบ: ${roundsSent} รอบ, รับ ${rxBytes} byte, ได้ ${epcs.length} แท็ก` +
          (rxBytes > 0 && epcs.length === 0
            ? " — เครื่องตอบมาแต่ parse เป็นแท็กไม่ได้ (เฟรม 'ไม่พบแท็ก' ตามปกติ หรือรูปแบบเฟรมไม่ตรง — ดู hex ด้านบน)"
            : '')
      );
      resolve({ epcs });
    };

    const sendRound = () => {
      roundsSent += 1;
      dbg(`ยิง inventory รอบ ${roundsSent}`);
      socket.write(inventoryFrame);
      armIdle();
    };

    // เงียบครบ idleTimeoutMs = เครื่องตอบรอบนี้จบแล้ว -> เก็บผล, เช็คว่านิ่งหรือยัง, ยิงรอบถัดไป/จบ
    const onRoundIdle = () => {
      const fresh = collect();
      stableStreak = fresh > 0 ? 0 : stableStreak + 1;
      dbg(`รอบ ${roundsSent}: EPC ใหม่ ${fresh} | รวม ${found.size} | นิ่งติดกัน ${stableStreak}/${stableRounds}`);
      if (stableStreak >= stableRounds || roundsSent >= maxRounds) {
        finish();
        return;
      }
      sendRound();
    };

    function armIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(onRoundIdle, idleTimeoutMs);
    }

    socket.setTimeout(connectTimeoutMs);

    socket.on('connect', () => {
      dbg('ต่อสำเร็จ');
      socket.setTimeout(0);
      maxTimer = setTimeout(() => finish(), maxWaitMs);
      if (setPowerFrame) {
        // สั่งตั้งกำลังส่งก่อน แล้วเว้นจังหวะให้เครื่องประมวลผล/ตอบ ack ก่อนเริ่ม inventory
        dbg(`ตั้งกำลังส่ง ${setPower}dBm`);
        socket.write(setPowerFrame);
        setTimeout(() => {
          if (!settled) sendRound();
        }, 250);
      } else {
        sendRound();
      }
    });

    socket.on('data', (chunk) => {
      rxBytes += chunk.length;
      // ยังไม่เริ่มยิง inventory (กำลังรอ ack ของ set-power) -> log แยกให้เห็นชัดว่าเครื่องตอบคำสั่ง
      // ตั้งกำลังว่าอะไร (ack ปกติ Len เล็ก Cmd ตรงกับที่ส่ง Status=0x00 / NAK จะได้ status ไม่ใช่ 0)
      // แล้วทิ้ง byte ทั้งชุด ไม่ให้ปน buffer ของเฟรมแท็ก และยังไม่ arm idle (กัน onRoundIdle ยิงซ้อน)
      if (roundsSent === 0) {
        const status = chunk.length >= 4 ? chunk[3] : null;
        dbg(
          `<< set-power resp ${chunk.length}B  ${hex(chunk)}` +
            (status === 0x00 ? '  (status 0x00 = OK)' : status !== null ? `  (status 0x${status.toString(16)} — เครื่องอาจไม่รองรับคำสั่งนี้)` : '')
        );
        return;
      }
      dbg(`<< ${chunk.length}B  ${hex(chunk)}`);
      buffer = Buffer.concat([buffer, chunk]);
      armIdle(); // ยังได้ข้อมูลอยู่ = รอบนี้ยังไม่จบ เลื่อน idle ออกไป
    });

    socket.on('timeout', () => {
      finish(new Error('เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ (connection timeout)'));
    });

    socket.on('error', (err) => {
      finish(err);
    });

    socket.connect({ host: ip, port });
  });
}
