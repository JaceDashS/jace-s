import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { roomService } from '../app/services/collaboration/roomService';
import { hashHostToken, verifyHostToken } from '../app/utils/hostToken';

const hostId = randomUUID();
const created = roomService.createRoom(hostId);

try {
  assert.ok(created.hostToken, '새 룸은 호스트 토큰을 발급해야 합니다.');
  assert.equal(created.room.hostTokenHash, hashHostToken(created.hostToken));
  assert.notEqual(created.room.hostTokenHash, created.hostToken);
  assert.equal(verifyHostToken(created.hostToken, created.room.hostTokenHash), true);
  assert.equal(verifyHostToken('invalid-host-token', created.room.hostTokenHash), false);

  const existing = roomService.createRoom(hostId);
  assert.equal(existing.room.roomCode, created.room.roomCode);
  assert.equal(existing.hostToken, null, '기존 룸 재조회에서는 토큰 원문을 재발급하지 않아야 합니다.');
} finally {
  roomService.deleteRoom(created.room.roomCode);
}

console.log('Host token tests passed.');
