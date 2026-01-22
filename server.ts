/**
 * Next.js 커스텀 서버
 * WebSocket 지원을 위해 Express 서버를 사용합니다.
 */

import { createServer } from 'http';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from 'dotenv';
import { resolve } from 'path';
import { signalingService } from './app/services/collaboration/signalingService';
import { roomService } from './app/services/collaboration/roomService';
import { getAllowedOriginsFromEnv } from './app/utils/corsOrigins';
import { logDebug, logInfo } from './app/utils/logging';

// 환경 변수 로드 (개발 환경일 때 .env.development, 프로덕션일 때 .env.production)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';
config({ path: resolve(process.cwd(), envFile) });

const dev = process.env.NODE_ENV === 'development';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// NODE_ENV 확인 로그
logInfo('=================================');
logInfo('Environment Check');
logInfo('=================================');
logInfo(`NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
logInfo(`dev variable: ${dev}`);
logInfo('=================================');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const { origins: allowedOrigins, isDevMode } = getAllowedOriginsFromEnv();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const isAllowedOrigin = !!origin && (isDevMode || allowedOrigins.includes(origin));

    if (origin && isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin, X-Client-Id, X-Host-Id');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    // OPTIONS 요청 (preflight) 처리
    if (req.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin) {
        res.writeHead(403);
        res.end();
        return;
      }

      res.writeHead(204);
      res.end();
      return;
    }
    
    handle(req, res);
  });

  // WebSocket 서버 설정
  const wss = new WebSocketServer({
    server,
    path: '/api/online-daw/signaling'
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const isAllowedOrigin = !origin || isDevMode || allowedOrigins.includes(origin);

    if (!isAllowedOrigin) {
      logInfo('[Online DAW] WebSocket connection rejected: origin not allowed', { origin });
      ws.close(1008, 'origin not allowed');
      return;
    }

    logInfo('[Online DAW] WebSocket connection attempt');
    // 클라이언트 ID 추출 (쿼리 파라미터)
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    logDebug('[Online DAW] WebSocket clientId:', { clientId });

    if (!clientId) {
      logInfo('[Online DAW] WebSocket connection rejected: clientId is required');
      ws.close(1008, 'clientId is required');
      return;
    }

    logInfo('[Online DAW] WebSocket connection established for client:', { clientId });
    // 연결 처리
    signalingService.handleConnection(ws, clientId);

    // 연결 확인 메시지 전송
    ws.send(JSON.stringify({
      action: 'connected',
      clientId,
      timestamp: Date.now()
    }));
  });

  // 만료된 룸 정리 스케줄러 (1분마다) - 6시간 만료 후 정리
  setInterval(() => {
    const deletedRoomCodes = roomService.cleanupExpiredRooms();
    if (deletedRoomCodes.length > 0) {
      logInfo(`[Online DAW] [${new Date().toISOString()}] Room(s) deleted due to expiration (6 hours): ${deletedRoomCodes.join(', ')}`);
    }
  }, 60 * 1000); // 1분

  // Phase 3: 오래된 WebSocket 연결 정리 스케줄러 (1분마다)
  setInterval(() => {
    const result = signalingService.cleanupDeadConnections();
    if (result.cleaned > 0 || result.roomsDeleted.length > 0) {
      if (result.cleaned > 0) {
        logInfo(`[Online DAW] [${new Date().toISOString()}] Cleaned up ${result.cleaned} dead WebSocket connection(s)`);
      }
      if (result.roomsDeleted.length > 0) {
        logInfo(`[Online DAW] [${new Date().toISOString()}] Room(s) deleted due to host connection closed: ${result.roomsDeleted.join(', ')}`);
      }
    }
  }, 60 * 1000); // 1분

  // 룸 만료 경고 스케줄러 (1분마다)
  setInterval(() => {
    const now = Date.now();
    const rooms = roomService.getAllRooms();
    
    for (const room of rooms) {
      const timeLeft = room.expiresAt - now;
      const minutesLeft = Math.floor(timeLeft / (60 * 1000));
      
      // 30분 전, 5분 전, 1분 전 경고
      if (minutesLeft === 30 || minutesLeft === 5 || minutesLeft === 1) {
        signalingService.broadcastToRoom(room.roomCode, {
          action: 'room-expiring',
          roomCode: room.roomCode,
          data: {
            minutesLeft
          },
          timestamp: now
        });
      }
      
      // 만료 시
      if (timeLeft <= 0) {
        signalingService.broadcastToRoom(room.roomCode, {
          action: 'room-session-expired',
          roomCode: room.roomCode,
          timestamp: now
        });
      }
    }
  }, 60 * 1000); // 1분

  server.listen(port, hostname, () => {
    logInfo(`=================================`);
    logInfo(`Online DAW Collaboration Server`);
    logInfo(`=================================`);
    logInfo(`Server running on http://${hostname}:${port}`);
    logInfo(`Local access: http://localhost:${port}`);
    logInfo(`WebSocket: ws://${hostname}:${port}/api/online-daw/signaling`);
    logInfo(`=================================`);
  });
});


