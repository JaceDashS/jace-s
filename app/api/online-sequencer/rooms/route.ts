/**
 * 룸 관리 REST API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { signalingService } from '@/app/services/collaboration/signalingService';
import type { CreateRoomRequest } from '@/app/types/collaboration/room';
import { createErrorResponse, logError, ErrorCode, createValidationError } from '@/app/utils/collaboration/errorHandler';
import { withApiLogging } from '@/app/utils/apiLogger';
import { logDebug } from '@/app/utils/logging';

/**
 * GET /api/online-sequencer/rooms
 * 모든 룸 정보 조회 (디버깅/모니터링용)
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/online-sequencer/rooms', async () => {
    try {
    const rooms = roomService.getAllRooms();
    const now = Date.now();
    
    // 각 룸에 대한 상세 정보 수집
    const roomsInfo = rooms.map(room => {
      const timeLeft = room.expiresAt - now;
      const minutesLeft = Math.floor(timeLeft / (60 * 1000));
      const connectedClients = signalingService.getRoomClients(room.roomCode);
      const clientConnections = signalingService.getRoomClientConnections(room.roomCode);
      
      return {
        roomCode: room.roomCode,
        hostId: room.hostId,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
        minutesLeft,
        allowJoin: room.allowJoin,
        allowJoinExpiresAt: room.allowJoinExpiresAt,
        participantCount: room.participants.length,
        participants: room.participants,
        maxParticipants: room.maxParticipants,
        connectedClients: connectedClients.length,
        connectedClientIds: connectedClients,
        clientConnections: clientConnections.map(conn => ({
          clientId: conn.clientId,
          role: conn.role,
          isOpen: conn.isOpen,
          readyState: conn.readyState // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
        }))
      };
    });
    
      return NextResponse.json({
        success: true,
        totalRooms: rooms.length,
        rooms: roomsInfo,
        timestamp: now
      });
    } catch (error) {
      logError('GET /api/online-sequencer/rooms', error);
      const { response, status } = createErrorResponse(
        'Failed to get rooms',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

/**
 * POST /api/online-sequencer/rooms
 * 룸 생성 (호스트가 "Host" 클릭 시)
 */
export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/online-sequencer/rooms', async () => {
    let hostId: string | undefined;
    try {
    const body: CreateRoomRequest = await request.json();
    hostId = body.hostId;
    logDebug(`[Online Sequencer] [POST /api/online-sequencer/rooms] Room creation request received hostId:${hostId}`);

    // 입력 검증
    if (!hostId || typeof hostId !== 'string') {
      const { response, status } = createValidationError('hostId', 'hostId is required and must be a string');
      return NextResponse.json(response, { status });
    }

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hostId)) {
      const { response, status } = createErrorResponse(
        'Invalid hostId format (must be a valid UUID)',
        ErrorCode.INVALID_HOST_ID,
        400
      );
      return NextResponse.json(response, { status });
    }

    // 룸 생성 (서버가 룸 코드 생성)
    const room = roomService.createRoom(hostId);
    logDebug(`[Online Sequencer] Room created:${room.roomCode} hostId:${room.hostId}`);

      return NextResponse.json({
        success: true,
        roomCode: room.roomCode,
        hostId: room.hostId,
        expiresAt: room.expiresAt,
        allowJoin: room.allowJoin,
        createdAt: room.createdAt
      });
    } catch (error) {
      logError('POST /api/online-sequencer/rooms', error, hostId ? { hostId } : undefined);
      
      if (error instanceof Error && error.message === 'No available room codes') {
        const { response, status } = createErrorResponse(
          'No available room codes',
          ErrorCode.NO_AVAILABLE_ROOM_CODES,
          409
        );
        return NextResponse.json(response, { status });
      }

      const { response, status } = createErrorResponse(
        'Failed to create room',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

