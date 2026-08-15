import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/app/services/collaboration/roomService';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { withApiLogging } from '@/app/utils/apiLogger';
import { getAdminSession } from '@/app/utils/adminAuth';

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

function toAdminRoomSummary(room: ReturnType<typeof roomService.getAllRooms>[number]) {
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

export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/online-sequencer/admin/rooms', async () => {
    if (!getAdminSession(request)) {
      return setCorsHeaders(request, createUnauthenticatedResponse());
    }

    roomService.cleanupExpiredRooms();
    const now = Date.now();
    const rooms = roomService
      .getAllRooms()
      .filter((room) => room.expiresAt > now)
      .map(toAdminRoomSummary);

    const response = NextResponse.json({
      success: true,
      data: {
        totalRooms: rooms.length,
        rooms,
        timestamp: now,
      },
    });
    response.headers.set('Cache-Control', 'no-store');
    return setCorsHeaders(request, response);
  });
}
