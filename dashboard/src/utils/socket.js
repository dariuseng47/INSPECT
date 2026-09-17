import { io } from 'socket.io-client';

import { CONFIG } from 'src/config-global';

import { STORAGE_KEY } from 'src/auth/context/jwt/constant';

// ----------------------------------------------------------------------

// Socket.io connects at the bare server origin, not under /api/v1 — CONFIG.serverUrl
// already has /api/v1 baked in (see src/utils/axios.js baseURL), so strip it here.
// Server auto-joins the socket into room `hospital:<id>` from the JWT — see
// server/src/sockets/index.js. No client-side room selection (multi-tenant isolation).
const SOCKET_ORIGIN = CONFIG.serverUrl.replace(/\/api\/v1\/?$/, '');

let socket = null;

// Lazy singleton — created on first use, reused after. `disconnectSocket` (called on
// sign-out) clears the singleton so the next getSocket() reconnects with the new session's
// token instead of silently keeping a stale connection.
export function getSocket() {
  if (socket) return socket;

  const accessToken = sessionStorage.getItem(STORAGE_KEY);

  socket = io(SOCKET_ORIGIN, {
    auth: { token: accessToken },
    autoConnect: true,
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
