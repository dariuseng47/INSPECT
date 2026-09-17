import { io } from 'socket.io-client';

import { getAccessToken } from './tokenStore';

// Mirrors dashboard/src/utils/socket.js — same auth handshake (JWT in `auth.token`), same
// server-side room-join-by-hospital_id. This is also what makes the app show up as "online"
// on the dashboard's user list (server/src/sockets/presence.js): connected while the app is
// in the foreground, disconnected the moment it backgrounds or the JWT is cleared — which is
// the right meaning of "is this handheld actually in use right now".
const SOCKET_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/api\/v1\/?$/,
  ''
);

let socket = null;

export function connectSocket() {
  if (socket) {
    socket.disconnect();
  }
  socket = io(SOCKET_ORIGIN, {
    // ฟังก์ชันแทน object ตรงๆ — reconnect ทุกครั้ง (เช่นหลุดเน็ตแล้วกลับมา) จะอ่าน access token
    // ล่าสุดจาก SecureStore สดๆ ใหม่เสมอ กัน reconnect fail เงียบๆ ถ้า token เดิมหมดอายุไปแล้ว
    auth: (cb) => {
      getAccessToken().then((token) => cb({ token }));
    },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
