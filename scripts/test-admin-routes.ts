import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as getAdminRooms } from '../app/api/online-sequencer/admin/rooms/route';
import {
  DELETE as deleteAdminRoom,
  GET as getAdminRoom,
} from '../app/api/online-sequencer/admin/rooms/[roomCode]/route';
import {
  createAdminSession,
  revokeAdminSession,
} from '../app/utils/adminAuth';

async function main(): Promise<void> {
  process.env.LOG_LEVEL = 'error';
  process.env.ADMIN_SESSION_SAME_SITE = 'strict';

const createRequest = (
  path: string,
  sessionId?: string,
  csrfToken?: string,
  csrfHeader?: string
) => new NextRequest(
  `http://localhost${path}`,
  {
    headers: {
      'x-forwarded-for': '198.51.100.10',
      'x-vercel-ip-city': 'Test City',
      ...(sessionId || csrfToken
        ? {
            Cookie: [
              sessionId ? `admin_session=${sessionId}` : null,
              csrfToken ? `admin_csrf=${csrfToken}` : null,
            ]
              .filter((value): value is string => value !== null)
              .join('; '),
          }
        : {}),
      ...(csrfHeader ? { 'x-csrf-token': csrfHeader } : {}),
    },
  }
);

const unauthenticatedRooms = await getAdminRooms(
  createRequest('/api/online-sequencer/admin/rooms')
);
assert.equal(unauthenticatedRooms.status, 401);

const session = createAdminSession();
try {
  const authenticatedRooms = await getAdminRooms(
    createRequest('/api/online-sequencer/admin/rooms', session.sessionId)
  );
  assert.equal(authenticatedRooms.status, 200);

  const invalidRoomCode = await getAdminRoom(
    createRequest('/api/online-sequencer/admin/rooms/12', session.sessionId),
    { params: Promise.resolve({ roomCode: '12' }) }
  );
  assert.equal(invalidRoomCode.status, 400);

  const missingRoom = await getAdminRoom(
    createRequest('/api/online-sequencer/admin/rooms/9999', session.sessionId),
    { params: Promise.resolve({ roomCode: '9999' }) }
  );
  assert.equal(missingRoom.status, 404);

  const unauthenticatedDelete = await deleteAdminRoom(
    createRequest('/api/online-sequencer/admin/rooms/9999'),
    { params: Promise.resolve({ roomCode: '9999' }) }
  );
  assert.equal(unauthenticatedDelete.status, 401);

  process.env.ADMIN_SESSION_SAME_SITE = 'none';
  const csrfProtectedDelete = await deleteAdminRoom(
    createRequest('/api/online-sequencer/admin/rooms/9999', session.sessionId),
    { params: Promise.resolve({ roomCode: '9999' }) }
  );
  assert.equal(csrfProtectedDelete.status, 403);

  const csrfToken = randomBytes(24).toString('base64url');
  const validCsrfDelete = await deleteAdminRoom(
    createRequest(
      '/api/online-sequencer/admin/rooms/9999',
      session.sessionId,
      csrfToken,
      csrfToken
    ),
    { params: Promise.resolve({ roomCode: '9999' }) }
  );
  assert.equal(validCsrfDelete.status, 404);
} finally {
  revokeAdminSession(createRequest('/api/auth/admin/session', session.sessionId));
}

  console.log('Admin route authorization tests passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
