/**
 * 룸 조회 및 삭제 REST API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { isValidRoomCode } from '@/app/utils/collaboration/roomCodeGenerator';
import type { RoomInfo } from '@/app/types/collaboration/room';
import { createErrorResponse, logError, ErrorCode } from '@/app/utils/collaboration/errorHandler';
import { withApiLogging } from '@/app/utils/apiLogger';
import { logDebug } from '@/app/utils/logging';

/**
 * GET /api/online-sequencer/rooms/:roomCode
 * 룸 조회 (참가자가 조인 시)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const resolvedParams = await params;
  const roomCode = resolvedParams.roomCode;
  return withApiLogging(request, `/api/online-sequencer/rooms/${roomCode}`, async () => {
    try {
    const clientId = request.headers.get('x-client-id') || undefined;
    logDebug(`[Online Sequencer] [GET /api/online-sequencer/rooms/:roomCode] Room lookup request:${roomCode} clientId:${clientId || 'none'}`);

    // 룸 코드 형식 검증
    if (!isValidRoomCode(roomCode)) {
      const { response, status } = createErrorResponse(
        'Invalid room code format (must be 4 digits)',
        ErrorCode.INVALID_ROOM_CODE,
        400
      );
      return NextResponse.json(response, { status });
    }

    // 룸 조회
    const room = roomService.getRoom(roomCode);

    if (!room) {
      const { response, status } = createErrorResponse(
        'Room not found',
        ErrorCode.ROOM_NOT_FOUND,
        404
      );
      return NextResponse.json(response, { status });
    }

    logDebug(`[Online Sequencer] Room found:${roomCode} allowJoin:${room.allowJoin} participantCount:${room.participants.length}`);

    // 조인 허용 만료 확인 및 업데이트
    roomService.checkAndUpdateAllowJoin(roomCode);

    // 강퇴된 참가자인지 확인 (clientId가 제공된 경우)
    let isKicked = false;
    if (clientId) {
      isKicked = roomService.isKickedParticipant(roomCode, clientId);
      if (isKicked) {
        logDebug(`[Online Sequencer] Client is kicked:${roomCode} clientId:${clientId}`);
      }
    }

    if (isKicked) {
      const { response, status } = createErrorResponse(
        'You have been kicked from this room',
        ErrorCode.KICKED,
        403,
        { roomCode: room.roomCode, roomCreatedAt: room.createdAt }
      );
      return NextResponse.json(response, { status });
    }

    // 룸 정보 반환
    const roomInfo: RoomInfo = {
      success: true,
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: Date.now() > room.expiresAt ? 'expired' : 'active',
      allowJoin: room.allowJoin,
      allowJoinExpiresAt: room.allowJoinExpiresAt,
      participantCount: room.participants.length,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt
    };

      logDebug(`[Online Sequencer] Room info returned:${roomCode} hostId:${roomInfo.hostId} status:${roomInfo.status}`);
      return NextResponse.json(roomInfo);
    } catch (error) {
      logError('GET /api/online-sequencer/rooms/:roomCode', error, { roomCode });
      const { response, status } = createErrorResponse(
        'Failed to get room',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

/**
 * DELETE /api/online-sequencer/rooms/:roomCode
 * 룸 삭제 (호스트가 "Stop Hosting" 클릭 시, 또는 6시간 후 자동)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const resolvedParams = await params;
  const roomCode = resolvedParams.roomCode;
  return withApiLogging(request, `/api/online-sequencer/rooms/${roomCode}`, async () => {
    try {
    const clientId = request.headers.get('x-client-id') || undefined;

    // 룸 코드 형식 검증
    if (!isValidRoomCode(roomCode)) {
      const { response, status } = createErrorResponse(
        'Invalid room code format (must be 4 digits)',
        ErrorCode.INVALID_ROOM_CODE,
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
        'Unauthorized: Only the host can delete the room',
        ErrorCode.UNAUTHORIZED,
        403
      );
      return NextResponse.json(response, { status });
    }

    // 룸 삭제
    logDebug(`[Online Sequencer] [DELETE /api/online-sequencer/rooms/:roomCode] Room deletion requested:${roomCode} clientId:${clientId || 'none'}`);
    roomService.deleteRoom(roomCode);
    logDebug(`[Online Sequencer] Room deleted:${roomCode}`);

      return NextResponse.json({
        success: true,
        roomCode
      });
    } catch (error) {
      logError('DELETE /api/online-sequencer/rooms/:roomCode', error, { roomCode });
      const { response, status } = createErrorResponse(
        'Failed to delete room',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

