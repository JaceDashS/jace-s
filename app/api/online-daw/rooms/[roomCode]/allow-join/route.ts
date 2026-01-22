/**
 * 조인 허용 활성화 REST API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { isValidRoomCode } from '@/app/utils/collaboration/roomCodeGenerator';
import type { AllowJoinRequest, AllowJoinResponse } from '@/app/types/collaboration/room';
import { createErrorResponse, logError, ErrorCode } from '@/app/utils/collaboration/errorHandler';
import { withApiLogging } from '@/app/utils/apiLogger';
import { logDebug } from '@/app/utils/logging';

/**
 * POST /api/online-daw/rooms/:roomCode/allow-join
 * 조인 허용 활성화 (호스트가 "Allow Join" 클릭 시)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const resolvedParams = await params;
  const roomCode = resolvedParams.roomCode;
  return withApiLogging(request, `/api/online-daw/rooms/${roomCode}/allow-join`, async () => {
    let duration: number | undefined;
    try {
    const body: AllowJoinRequest = await request.json();
    duration = body.duration || 60;
    const clientId = request.headers.get('x-client-id') || undefined;
    logDebug(`[Online DAW] [POST /api/online-daw/rooms/:roomCode/allow-join] Allow join request received:${roomCode} duration:${duration} clientId:${clientId || 'none'}`);

    // 룸 코드 형식 검증
    if (!isValidRoomCode(roomCode)) {
      const { response, status } = createErrorResponse(
        'Invalid room code format (must be 4 digits)',
        ErrorCode.INVALID_ROOM_CODE,
        400
      );
      return NextResponse.json(response, { status });
    }

    // duration 검증
    if (typeof duration !== 'number' || duration <= 0 || duration > 3600) {
      const { response, status } = createErrorResponse(
        'Invalid duration (must be between 1 and 3600 seconds)',
        ErrorCode.INVALID_DURATION,
        400
      );
      return NextResponse.json(response, { status });
    }

    // 룸 존재 확인
    const room = roomService.getRoom(roomCode);
    if (!room) {
      const { response, status } = createErrorResponse(
        'Room not found',
        ErrorCode.ROOM_NOT_FOUND,
        404
      );
      return NextResponse.json(response, { status });
    }

    // 호스트 권한 확인
    if (clientId && room.hostId !== clientId) {
      const { response, status } = createErrorResponse(
        'Unauthorized: Only the host can allow join',
        ErrorCode.UNAUTHORIZED,
        403
      );
      return NextResponse.json(response, { status });
    }

    // 조인 허용 활성화
    roomService.allowJoin(roomCode, duration);
    const expiresAt = Date.now() + duration * 1000;
    logDebug(`[Online DAW] Allow join activated:${roomCode} duration:${duration} expiresAt:${expiresAt}`);

    // 업데이트된 룸 정보 조회
    const updatedRoom = roomService.getRoom(roomCode);
    if (!updatedRoom) {
      logDebug(`[Online DAW] Room not found after allowJoin:${roomCode}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Room not found'
        },
        { status: 404 }
      );
    }

    const response: AllowJoinResponse = {
      success: true,
      allowJoin: updatedRoom.allowJoin,
      allowJoinExpiresAt: updatedRoom.allowJoinExpiresAt!
    };

      logDebug(`[Online DAW] Allow join response:${roomCode} allowJoin:${response.allowJoin} expiresAt:${response.allowJoinExpiresAt}`);
      return NextResponse.json(response);
    } catch (error) {
      logError('POST /api/online-daw/rooms/:roomCode/allow-join', error, { roomCode, duration });
      
      if (error instanceof Error && error.message === 'Room not found') {
        const { response, status } = createErrorResponse(
          'Room not found',
          ErrorCode.ROOM_NOT_FOUND,
          404
        );
        return NextResponse.json(response, { status });
      }

      const { response, status } = createErrorResponse(
        'Failed to allow join',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

