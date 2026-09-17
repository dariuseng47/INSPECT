// "ออนไลน์" = มี Socket.io connection ค้างอยู่อย่างน้อย 1 เส้น (เว็บแท็บที่เปิดอยู่ หรือแอปมือถือที่
// เปิดอยู่หน้าจอ — มือถือจะดูเหมือน "ออฟไลน์" ทันทีที่ background เพราะ RN ตัดการเชื่อมต่อ ถือว่า
// ถูกต้องแล้วสำหรับความหมาย "handheld ตัวนี้กำลังใช้งานอยู่จริงไหม") เก็บเป็น in-memory ล้วนๆ
// ไม่ persist ลง DB เพราะไม่ต้องรอด surviving restart — ต่าง user ล็อกอินพร้อมกันหลาย tab/เครื่อง
// นับ socketId แยกกัน ต้องหลุดครบทุกเส้นก่อนถึงจะเป็น offline จริง

const onlineUsers = new Map(); // userId -> { hospitalId, role, socketIds: Set<string> }

export function markOnline(userId, hospitalId, role, socketId) {
  const entry = onlineUsers.get(userId) ?? { hospitalId, role, socketIds: new Set() };
  entry.socketIds.add(socketId);
  onlineUsers.set(userId, entry);
}

// คืนค่า true ถ้าเพิ่ง offline จริง (socket เส้นสุดท้ายหลุด) — ใช้ตัดสินใจว่าต้องยิง
// presence:update บอกคนอื่นไหม ไม่งั้นแค่ปิด 1 ใน N tab ก็จะเห็น false-positive offline
export function markOffline(userId, socketId) {
  const entry = onlineUsers.get(userId);
  if (!entry) return false;
  entry.socketIds.delete(socketId);
  if (entry.socketIds.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId) {
  return onlineUsers.has(userId);
}

export function getOnlineUserIds(hospitalId) {
  return [...onlineUsers.entries()]
    .filter(([, entry]) => entry.hospitalId === hospitalId)
    .map(([userId]) => userId);
}
