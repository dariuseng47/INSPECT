import http from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { setIO } from './sockets/ioInstance.js';
import { initSocket } from './sockets/index.js';
import { startHeartbeatMonitor } from './jobs/deviceHeartbeatMonitor.js';

const app = createApp();
const httpServer = http.createServer(app);

setIO(initSocket(httpServer));
startHeartbeatMonitor();

httpServer.listen(env.PORT, () => {
  console.log(`🧺 LMS server กำลังทำงานที่ http://localhost:${env.PORT} (env: ${env.NODE_ENV})`);
});
