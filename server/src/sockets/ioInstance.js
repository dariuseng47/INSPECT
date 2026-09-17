// Singleton accessor ให้ controller เรียก io.emit(...) ได้โดยไม่ต้อง inject ผ่าน req
// (Express request object ไม่มี io instance อยู่แล้วโดย default)
let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}
