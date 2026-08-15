import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { signalingService } from '@/app/services/collaboration/signalingService';
import { isValidRoomCode } from '@/app/utils/collaboration/roomCodeGenerator';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { withApiLogging } from '@/app/utils/apiLogger';
import { getAdminRequestIP, getAdminSession, hasValidAdminCsrf } from '@/app/utils/adminAuth';
import { logAdminAudit } from '@/app/utils/adminAudit';

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

function createRoomCodeErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'INVALID_ROOM_CODE' },
    { status: 400 }
  );
}

function createRoomNotFoundResponse(): NextResponse {
  return NextResponse.json(
    { error: 'ROOM_NOT_FOUND' },
    { status: 404 }
  );
}

function createCsrfValidationErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'CSRF_VALIDATION_FAILED' },
    { status: 403 }
  );
}

function toAdminRoomSummary(room: ReturnType<typeof roomService.getRoom>) {
  if (!room) {
    return null;
  }

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    participantCount: room.participants.length,
    status: 'active' as const,
  };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  return withApiLogging(request, `/api/online-sequencer/admin/rooms/${roomCode}`, async () => {
    if (!getAdminSession(request)) {
      return setCorsHeaders(request, createUnauthenticatedResponse());
    }

    if (!isValidRoomCode(roomCode)) {
      return setCorsHeaders(request, createRoomCodeErrorResponse());
    }

    const room = roomService.getRoom(roomCode);
    const summary = toAdminRoomSummary(room);
    if (!summary) {
      return setCorsHeaders(request, createRoomNotFoundResponse());
    }

    const response = NextResponse.json({
      success: true,
      data: summary,
    });
    response.headers.set('Cache-Control', 'no-store');
    return setCorsHeaders(request, response);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  return withApiLogging(request, `/api/online-sequencer/admin/rooms/${roomCode}`, async () => {
    if (!getAdminSession(request)) {
      return setCorsHeaders(request, createUnauthenticatedResponse());
    }

    if (!hasValidAdminCsrf(request)) {
      return setCorsHeaders(request, createCsrfValidationErrorResponse());
    }

    if (!isValidRoomCode(roomCode)) {
      return setCorsHeaders(request, createRoomCodeErrorResponse());
    }

    const room = roomService.getRoom(roomCode);
    if (!room) {
      return setCorsHeaders(request, createRoomNotFoundResponse());
    }

    signalingService.notifyRoomClosed(roomCode);
    roomService.deleteRoom(roomCode);
    logAdminAudit('admin_room_deleted', {
      ip: getAdminRequestIP(request),
      roomCode,
      result: 'deleted',
    });

    const response = NextResponse.json({
      success: true,
      roomCode,
    });
    response.headers.set('Cache-Control', 'no-store');
    return setCorsHeaders(request, response);
  });
}
