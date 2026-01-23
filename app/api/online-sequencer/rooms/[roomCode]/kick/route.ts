/**
 * 참가자 강퇴 REST API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { isValidRoomCode } from '@/app/utils/collaboration/roomCodeGenerator';
import type { KickParticipantRequest, KickParticipantResponse } from '@/app/types/collaboration/room';
import { createErrorResponse, logError, ErrorCode } from '@/app/utils/collaboration/errorHandler';
import { withApiLogging } from '@/app/utils/apiLogger';

/**
 * POST /api/online-sequencer/rooms/:roomCode/kick
 * 참가자 강퇴 (호스트가 강퇴 버튼 클릭 시)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const resolvedParams = await params;
  const roomCode = resolvedParams.roomCode;
  return withApiLogging(request, `/api/online-sequencer/rooms/${roomCode}/kick`, async () => {
    let participantId: string | undefined;
    try {
    const body: KickParticipantRequest = await request.json();
    participantId = body.participantId;
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

    // participantId 검증
    if (!participantId || typeof participantId !== 'string') {
      const { response, status } = createErrorResponse(
        'participantId is required and must be a string',
        ErrorCode.INVALID_PARTICIPANT_ID,
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
        'Unauthorized: Only the host can kick participants',
        ErrorCode.UNAUTHORIZED,
        403
      );
      return NextResponse.json(response, { status });
    }

    // 참가자 존재 확인
    if (!room.participants.includes(participantId)) {
      const { response, status } = createErrorResponse(
        'Participant not found in room',
        ErrorCode.PARTICIPANT_NOT_FOUND,
        404
      );
      return NextResponse.json(response, { status });
    }

    // 참가자 강퇴
    roomService.kickParticipant(roomCode, participantId);

    // 강퇴된 참가자에게 'kicked' 메시지 전송은 WebSocket을 통해 처리
    // (SignalingService에서 처리)
    // Note: signalingService는 서버에서만 사용 가능하므로 여기서는 직접 호출하지 않음
    // WebSocket 서버에서 처리됨

      const response: KickParticipantResponse = {
        success: true,
        message: 'Participant kicked'
      };

      return NextResponse.json(response);
    } catch (error) {
      logError('POST /api/online-sequencer/rooms/:roomCode/kick', error, { roomCode, participantId });
      
      if (error instanceof Error && error.message === 'Room not found') {
        const { response, status } = createErrorResponse(
          'Room not found',
          ErrorCode.ROOM_NOT_FOUND,
          404
        );
        return NextResponse.json(response, { status });
      }

      const { response, status } = createErrorResponse(
        'Failed to kick participant',
        ErrorCode.INTERNAL_ERROR,
        500
      );
      return NextResponse.json(response, { status });
    }
  });
}

