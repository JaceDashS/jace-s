import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { roomService } from '../app/services/collaboration/roomService';
import { SignalingService } from '../app/services/collaboration/signalingService';

type MessageHandler = (data?: Buffer) => void;

class FakeWebSocket {
  readyState = WebSocket.OPEN;
  sent: string[] = [];
  private handlers = new Map<string, MessageHandler[]>();

  on(event: string, handler: MessageHandler): this {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  send(message: string): void {
    this.sent.push(message);
  }

  emit(event: string, data?: Buffer): void {
    for (const handler of this.handlers.get(event) || []) {
      handler(data);
    }
  }
}

const hostId = randomUUID();
const created = roomService.createRoom(hostId);
const fakeWebSocket = new FakeWebSocket();
const signalingService = new SignalingService();

try {
  signalingService.handleConnection(
    fakeWebSocket as unknown as WebSocket,
    'spoofed-client-id'
  );

  fakeWebSocket.emit('message', Buffer.from(JSON.stringify({
    action: 'register',
    roomCode: created.room.roomCode,
    clientId: 'spoofed-client-id',
    data: { role: 'host' },
  })));

  const rejected = JSON.parse(fakeWebSocket.sent.at(-1) || '{}') as { action?: string; error?: string };
  assert.equal(rejected.action, 'error');
  assert.equal(rejected.error, 'Unauthorized: Invalid host token');

  fakeWebSocket.emit('message', Buffer.from(JSON.stringify({
    action: 'register',
    roomCode: created.room.roomCode,
    clientId: 'spoofed-client-id',
    data: { role: 'host', hostToken: created.hostToken },
  })));

  const accepted = JSON.parse(fakeWebSocket.sent.at(-1) || '{}') as { action?: string; roomCode?: string };
  assert.equal(accepted.action, 'registered');
  assert.equal(accepted.roomCode, created.room.roomCode);
} finally {
  roomService.deleteRoom(created.room.roomCode);
}

console.log('WebSocket host authentication tests passed.');
