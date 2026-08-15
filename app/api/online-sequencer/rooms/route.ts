/**
 * 룸 관리 REST API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import type { CreateRoomRequest } from '@/app/types/collaboration/room';
import { createErrorResponse, logError, ErrorCode, createValidationError } from '@/app/utils/collaboration/errorHandler';
import { withApiLogging } from '@/app/utils/apiLogger';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { getAdminSession } from '@/app/utils/adminAuth';
import { getBearerToken, verifyHostToken } from '@/app/utils/hostToken';
import { logDebug } from '@/app/utils/logging';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createUnauthenticatedResponse(): NextResponse {
  const response = NextResponse.json(
    { error: 'UNAUTHENTICATED' },
    { status: 401 }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

/**
 * GET /api/online-sequencer/rooms
 * 모든 룸 정보 조회 (디버깅/모니터링용)
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/online-sequencer/rooms', async () => {
    if (!getAdminSession(request)) {
      return setCorsHeaders(request, createUnauthenticatedResponse());
    }

    try {
      roomService.cleanupExpiredRooms();
      const now = Date.now();
      const rooms = roomService
        .getAllRooms()
        .filter((room) => room.expiresAt > now)
        .map((room) => ({
          roomCode: room.roomCode,
          hostId: room.hostId,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
          participantCount: room.participants.length,
          status: 'active' as const,
        }));
    
      const response = NextResponse.json({
        success: true,
        data: {
          totalRooms: rooms.length,
          rooms,
          timestamp: now,
        },
      });
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Deprecation', 'true');
      response.headers.set('Link', '</api/online-sequencer/admin/rooms>; rel="successor-version"');
      return setCorsHeaders(request, response);
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

    // 기존 룸 재등록은 기존 호스트 토큰으로만 허용
    const existingRoom = roomService.getRoomByHostId(hostId);
    if (existingRoom) {
      const hostToken = getBearerToken(request);
      if (!hostToken) {
        const { response, status } = createErrorResponse(
          'Host authentication required',
          ErrorCode.UNAUTHORIZED,
          401
        );
        return NextResponse.json(response, { status });
      }

      if (!verifyHostToken(hostToken, existingRoom.hostTokenHash)) {
        const { response, status } = createErrorResponse(
          'Unauthorized: Invalid host token',
          ErrorCode.UNAUTHORIZED,
          403
        );
        return NextResponse.json(response, { status });
      }

      logDebug(`[Online Sequencer] Existing room re-registered:${existingRoom.roomCode} hostId:${existingRoom.hostId}`);
      return NextResponse.json({
        success: true,
        roomCode: existingRoom.roomCode,
        hostId: existingRoom.hostId,
        hostToken: null,
        expiresAt: existingRoom.expiresAt,
        allowJoin: existingRoom.allowJoin,
        createdAt: existingRoom.createdAt
      });
    }

    // 룸 생성 (서버가 룸 코드와 호스트 토큰 생성)
    const { room, hostToken } = roomService.createRoom(hostId);
    logDebug(`[Online Sequencer] Room created:${room.roomCode} hostId:${room.hostId}`);

      return NextResponse.json({
        success: true,
        roomCode: room.roomCode,
        hostId: room.hostId,
        hostToken,
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
