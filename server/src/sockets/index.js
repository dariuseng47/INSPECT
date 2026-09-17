import { Server } from 'socket.io';

import { isAllowedOrigin } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { markOnline, markOffline } from './presence.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ไม่ได้รับอนุญาต — ${origin}`));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyAccessToken(token);
      socket.auth = { userId: payload.sub, role: payload.role };
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.auth;

    // "ออนไลน์" ของ user นี้ — ดู presence.js สำหรับความหมายละเอียด
    // ยิง presence:update ให้ทุกคนเห็นแบบ real-time (หน้า "ผู้ใช้งาน & สิทธิ์")
    markOnline(userId, socket.id);
    io.emit('presence:update', { userId, online: true });

    socket.on('disconnect', () => {
      const wentOffline = markOffline(userId, socket.id);
      if (wentOffline) {
        io.emit('presence:update', { userId, online: false });
      }
    });
  });

  return io;
}
