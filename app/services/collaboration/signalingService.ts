/**
 * WebSocket 시그널링 서비스
 * WebRTC 시그널링 메시지(offer, answer, ice-candidate)를 라우팅합니다.
 */

import { WebSocket } from 'ws';
import { roomService } from './roomService';

/**
 * 시그널링 메시지 타입 (WebRTC 시그널링용)
 */
// WebRTC 타입 정의
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;        // 발신자 ID (hostId 또는 participantId)
  to: string;          // 수신자 ID
  roomCode: string;    // 룸 코드
  data: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
  timestamp: number;
}

/**
 * 클라이언트 → 서버 메시지 (WebSocket)
 */
export interface ClientToServerMessage {
  action: 'register' | 'join' | 'signaling' | 'leave';
  roomCode: string;
  clientId: string;
  data?: {
    role?: 'host' | 'participant';
    type?: 'offer' | 'answer' | 'ice-candidate';
    to?: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    [key: string]: unknown;
  };
}

/**
 * 서버 → 클라이언트 메시지 (WebSocket)
 */
export interface ServerToClientMessage {
  action: 'connected' | 'registered' | 'joined' | 'signaling' | 'error' | 'room-closed' | 'kicked' | 'allow-join-expired' | 'room-expiring' | 'room-session-expired' | 'participant-joined' | 'participant-left';
  roomCode?: string;
  clientId?: string;
  data?: {
    status?: string;
    hostId?: string;
    participantId?: string;
    participantCount?: number;
    minutesLeft?: number;
    roomCreatedAt?: number;
    [key: string]: unknown;
  };
  error?: string;
  timestamp?: number;
}

/**
 * 클라이언트 연결 정보
 */
interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  roomCode: string | null;
  role: 'host' | 'participant' | null;
}

/**
 * 룸별 클라이언트 연결 관리
 */
class SignalingStore {
  private connections = new Map<string, ClientConnection>(); // clientId -> connection
  private roomClients = new Map<string, Set<string>>();      // roomCode -> Set<clientId>

  addConnection(clientId: string, ws: WebSocket): void {
    this.connections.set(clientId, {
      ws,
      clientId,
      roomCode: null,
      role: null
    });
  }

  removeConnection(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection?.roomCode) {
      const clients = this.roomClients.get(connection.roomCode);
      if (clients) {
        clients.delete(clientId);
        if (clients.size === 0) {
          this.roomClients.delete(connection.roomCode);
        }
      }
    }
    this.connections.delete(clientId);
  }

  /**
   * Phase 3: 오래된 연결 정리 (dead connection cleanup)
   * WebSocket이 닫혔지만 정상적으로 제거되지 않은 연결을 정리합니다.
   */
  cleanupDeadConnections(): { cleaned: number; roomsDeleted: string[] } {
    let cleaned = 0;
    const roomsToDelete = new Map<string, string>(); // roomCode -> hostId
    
    for (const [clientId, connection] of this.connections.entries()) {
      const readyState = connection.ws.readyState;
      const isClosed = readyState !== WebSocket.OPEN && readyState !== WebSocket.CONNECTING;
      
      if (isClosed) {
        // 연결이 닫혔거나 닫히는 중인 경우 즉시 정리
        if (connection.roomCode && connection.role === 'host') {
          // 호스트 연결이 끊어진 경우 룸 삭제
          roomsToDelete.set(connection.roomCode, clientId);
        }
        this.removeConnection(clientId);
        cleaned++;
      }
    }
    
    return { cleaned, roomsDeleted: Array.from(roomsToDelete.keys()) };
  }

  setRoom(clientId: string, roomCode: string, role: 'host' | 'participant'): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    // 이전 룸에서 제거
    if (connection.roomCode) {
      const prevClients = this.roomClients.get(connection.roomCode);
      if (prevClients) {
        prevClients.delete(clientId);
      }
    }

    // 새 룸에 추가
    connection.roomCode = roomCode;
    connection.role = role;

    if (!this.roomClients.has(roomCode)) {
      this.roomClients.set(roomCode, new Set());
    }
    this.roomClients.get(roomCode)!.add(clientId);
  }

  getConnection(clientId: string): ClientConnection | undefined {
    return this.connections.get(clientId);
  }

  getRoomClients(roomCode: string): string[] {
    const clients = this.roomClients.get(roomCode);
    return clients ? Array.from(clients) : [];
  }

  /**
   * 룸의 모든 클라이언트 연결 정보 조회 (상세 정보 포함)
   */
  getRoomClientConnections(roomCode: string): Array<{
    clientId: string;
    role: 'host' | 'participant' | null;
    readyState: number;
    isOpen: boolean;
  }> {
    const clients = this.roomClients.get(roomCode);
    if (!clients) {
      return [];
    }
    
    return Array.from(clients).map(clientId => {
      const connection = this.connections.get(clientId);
      if (!connection) {
        return null;
      }
      
      const readyState = connection.ws.readyState;
      const isOpen = readyState === WebSocket.OPEN;
      
      return {
        clientId,
        role: connection.role,
        readyState,
        isOpen
      };
    }).filter((conn): conn is NonNullable<typeof conn> => conn !== null);
  }
}

const signalingStore = new SignalingStore();

/**
 * 시그널링 서비스
 */
export class SignalingService {
  /**
   * 클라이언트 연결 처리
   */
  handleConnection(ws: WebSocket, clientId: string): void {
    signalingStore.addConnection(clientId, ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientToServerMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Error parsing message:', error);
        ws.send(JSON.stringify({
          action: 'error',
          error: 'Invalid message format',
          timestamp: Date.now()
        } as ServerToClientMessage));
      }
    });

    ws.on('close', () => {
      const connection = signalingStore.getConnection(clientId);
      if (connection?.roomCode) {
        roomService.removeParticipant(connection.roomCode, clientId);
      }
      signalingStore.removeConnection(clientId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      const connection = signalingStore.getConnection(clientId);
      if (connection?.roomCode) {
        roomService.removeParticipant(connection.roomCode, clientId);
      }
      signalingStore.removeConnection(clientId);
    });
  }

  /**
   * 룸에 클라이언트 등록
   */
  registerClient(clientId: string, roomCode: string, role: 'host' | 'participant'): void {
    signalingStore.setRoom(clientId, roomCode, role);
  }

  /**
   * 메시지 처리 (register, join, signaling, leave)
   */
  private handleMessage(senderId: string, message: ClientToServerMessage): void {
    console.log('[Online DAW] WebSocket message received:', { senderId, action: message.action, roomCode: message.roomCode });
    const sender = signalingStore.getConnection(senderId);
    if (!sender) {
      console.log('[Online DAW] Sender not found:', senderId);
      return;
    }

    try {
      switch (message.action) {
        case 'register':
          console.log('[Online DAW] Processing register action');
          this.handleRegister(senderId, message);
          break;
        case 'join':
          console.log('[Online DAW] Processing join action');
          this.handleJoin(senderId, message);
          break;
        case 'signaling':
          this.handleSignaling(senderId, message);
          break;
        case 'leave':
          this.handleLeave(senderId);
          break;
        default:
          this.sendError(senderId, `Unknown action: ${message.action}`);
      }
    } catch (error) {
      console.error('[Online DAW] Error handling message:', error);
      this.sendError(senderId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 호스트 등록 처리
   */
  private handleRegister(clientId: string, message: ClientToServerMessage): void {
    const { roomCode, data } = message;
    
    console.log('[Online DAW] [handleRegister] Processing register:', { clientId, roomCode, data });
    
    if (!data?.role) {
      console.log('[Online DAW] [handleRegister] Error: role is missing');
      this.sendError(clientId, 'Invalid register message: role is required');
      return;
    }

    if (data.role !== 'host') {
      console.log('[Online DAW] [handleRegister] Error: Invalid role:', data.role);
      this.sendError(clientId, 'Invalid role: register action requires host role');
      return;
    }

    // roomCode가 없으면 hostId로 룸 찾기 (방 생성 직후 register 시나리오)
    let targetRoomCode = roomCode;
    if (!targetRoomCode) {
      console.log('[Online DAW] [handleRegister] roomCode not provided, searching room by hostId:', clientId);
      
      // 모든 룸 확인
      const allRooms = roomService.getAllRooms();
      console.log('[Online DAW] [handleRegister] All rooms:', allRooms.map(r => ({ roomCode: r.roomCode, hostId: r.hostId, createdAt: r.createdAt })));
      
      const room = roomService.getRoomByHostId(clientId);
      if (!room) {
        console.log('[Online DAW] [handleRegister] Error: No active room found for hostId:', clientId);
        this.sendError(clientId, 'No active room found for this host. Please create a room first.');
        return;
      }
      targetRoomCode = room.roomCode;
      console.log('[Online DAW] [handleRegister] Found room by hostId:', { hostId: clientId, roomCode: targetRoomCode });
    } else {
      console.log('[Online DAW] [handleRegister] Using provided roomCode:', targetRoomCode);
    }

    // 룸 존재 확인
    const room = roomService.getRoom(targetRoomCode);
    if (!room) {
      console.log('[Online DAW] [handleRegister] Error: Room not found:', targetRoomCode);
      this.sendError(clientId, `Room not found: ${targetRoomCode}`);
      return;
    }

    console.log('[Online DAW] [handleRegister] Room found:', { roomCode: room.roomCode, hostId: room.hostId, clientId });

    // 호스트 권한 확인
    if (room.hostId !== clientId) {
      console.log('[Online DAW] [handleRegister] Error: Unauthorized - hostId mismatch:', { roomHostId: room.hostId, clientId });
      this.sendError(clientId, 'Unauthorized: You are not the host of this room');
      return;
    }

    // 룸에 호스트 등록
    console.log('[Online DAW] [handleRegister] Registering host to room:', { clientId, roomCode: targetRoomCode });
    this.registerClient(clientId, targetRoomCode, 'host');

    // 등록 성공 응답
    console.log('[Online DAW] [handleRegister] Registration successful, sending response');
    this.sendToClient(clientId, {
      action: 'registered',
      roomCode: targetRoomCode,
      data: {
        status: 'active'
      },
      timestamp: Date.now()
    } as ServerToClientMessage);
  }

  /**
   * 참가자 조인 처리
   */
  private handleJoin(clientId: string, message: ClientToServerMessage): void {
    console.log('[Online DAW] Handling join for client:', clientId);
    const { roomCode, data } = message;
    
    // data가 없거나 role이 없으면 기본값으로 participant 설정
    const role = data?.role || 'participant';
    
    if (!roomCode) {
      console.log('[Online DAW] Join failed: roomCode is required');
      this.sendError(clientId, 'Invalid join message: roomCode is required');
      return;
    }

    if (role !== 'participant') {
      console.log('[Online DAW] Join failed: Invalid role:', role);
      this.sendError(clientId, 'Invalid role: join action requires participant role');
      return;
    }

    // 룸 정보 확인
    console.log('[Online DAW] Looking up room:', roomCode);
    const room = roomService.getRoom(roomCode);
    
    if (!room) {
      console.log('[Online DAW] Join failed: Room not found:', roomCode);
      console.log('[Online DAW] Available rooms:', roomService.getAllRooms().map(r => r.roomCode));
      this.sendError(clientId, 'Room not found');
      return;
    }
    
    console.log('[Online DAW] Room found for join:', { roomCode, hostId: room.hostId, allowJoin: room.allowJoin });

    // 호스트가 자신의 룸에 게스트로 조인하는 것을 방지
    if (room.hostId === clientId) {
      console.log('[Online DAW] Join failed: Host cannot join their own room');
      this.sendError(clientId, 'Host cannot join their own room as a participant');
      return;
    }

    // 조인 허용 여부 확인
    if (!room.allowJoin) {
      console.log('[Online DAW] Join failed: Room is not accepting new participants');
      this.sendError(clientId, 'Room is not accepting new participants');
      return;
    }

    // 룸에 참가자 등록
    console.log('[Online DAW] Registering participant:', { clientId, roomCode });
    this.registerClient(clientId, roomCode, 'participant');

    // 참가자 추가 (roomService)
    roomService.addParticipant(roomCode, clientId);
    const updatedRoom = roomService.getRoom(roomCode);
    
    if (updatedRoom) {
      console.log('[Online DAW] Participant added to room:', {
        roomCode,
        clientId,
        participantCount: updatedRoom.participants.length
      });
    }

    // 조인 성공 응답 (참가자에게)
    console.log('[Online DAW] Sending joined response to client:', clientId);
    this.sendToClient(clientId, {
      action: 'joined',
      roomCode,
      data: {
        hostId: room.hostId,
        status: 'active',
        roomCreatedAt: room.createdAt
      },
      timestamp: Date.now()
    } as ServerToClientMessage);

    // Notify room about participant join
    if (updatedRoom) {
      console.log('[Online DAW] Broadcasting participant join:', {
        roomCode,
        participantId: clientId
      });
      this.broadcastToRoom(roomCode, {
        action: 'participant-joined',
        roomCode,
        data: {
          participantId: clientId,
          participantCount: updatedRoom.participants.length
        },
        timestamp: Date.now()
      } as ServerToClientMessage, clientId);
    }
  }

  /**
   * 시그널링 메시지 처리 (WebRTC offer/answer/ice-candidate)
   */
  private handleSignaling(senderId: string, message: ClientToServerMessage): void {
    const sender = signalingStore.getConnection(senderId);
    if (!sender) {
      console.log('[Online DAW] Signaling failed: Sender not found:', senderId);
      return;
    }

    const { roomCode, data } = message;

    if (!roomCode || !data?.type || !data?.to) {
      console.log('[Online DAW] Signaling failed: Invalid message format:', { roomCode, hasType: !!data?.type, hasTo: !!data?.to });
      this.sendError(senderId, 'Invalid signaling message: roomCode, type, and to are required');
      return;
    }

    // 룸 코드 검증
    if (sender.roomCode !== roomCode) {
      console.log('[Online DAW] Signaling failed: Sender not in room:', { senderId, senderRoom: sender.roomCode, messageRoom: roomCode });
      this.sendError(senderId, 'Client is not in the specified room');
      return;
    }

    // 수신자 찾기
    const receiver = signalingStore.getConnection(data.to);
    if (!receiver) {
      console.log('[Online DAW] Signaling failed: Receiver not found:', data.to);
      this.sendError(senderId, `Receiver ${data.to} not found`);
      return;
    }

    // 수신자의 룸 코드 확인
    if (receiver.roomCode !== roomCode) {
      console.log('[Online DAW] Signaling failed: Receiver not in room:', { receiverId: data.to, receiverRoom: receiver.roomCode, messageRoom: roomCode });
      this.sendError(senderId, `Receiver ${data.to} is not in room ${roomCode}`);
      return;
    }

    // 시그널링 메시지 전달
    const signalingMessage: ServerToClientMessage = {
      action: 'signaling',
      roomCode,
      data: {
        type: data.type,
        from: senderId,
        sdp: data.sdp,
        candidate: data.candidate
      },
      timestamp: Date.now()
    };

    if (receiver.ws.readyState === WebSocket.OPEN) {
      receiver.ws.send(JSON.stringify(signalingMessage));
      console.log('[Online DAW] Signaling message forwarded:', { from: senderId, to: data.to, type: data.type });
    } else {
      console.log('[Online DAW] Signaling failed: Receiver WebSocket not open:', { receiverId: data.to, readyState: receiver.ws.readyState });
    }
  }

  /**
   * 룸 나가기 처리
   */
  private handleLeave(clientId: string): void {
    const connection = signalingStore.getConnection(clientId);
    if (connection?.roomCode) {
      const roomCode = connection.roomCode;
      const role = connection.role;
      
      // 호스트가 leave하면 룸 삭제
      if (role === 'host') {
        const room = roomService.getRoom(roomCode);
        if (room) {
          // 모든 참가자에게 room-closed 알림
          this.notifyRoomClosed(roomCode);
          // 룸 삭제
          roomService.deleteRoom(roomCode);
          console.log(`[Online DAW] [${new Date().toISOString()}] Room deleted due to host leave: ${roomCode} (hostId: ${clientId})`);
        }
      } else {
        // 참가자 제거 (roomService)
        roomService.removeParticipant(roomCode, clientId);
        
        // Notify room about participant leave
        const updatedRoom = roomService.getRoom(roomCode);
        if (updatedRoom) {
          this.broadcastToRoom(roomCode, {
            action: 'participant-left',
            roomCode,
            data: {
              participantId: clientId,
              participantCount: updatedRoom.participants.length
            },
            timestamp: Date.now()
          } as ServerToClientMessage, clientId);
        }
      }
      
      // 룸에서 제거
      signalingStore.removeConnection(clientId);
    }
  }

  /**
   * 에러 메시지 전송
   */
  private sendError(clientId: string, errorMessage: string): void {
    this.sendToClient(clientId, {
      action: 'error',
      error: errorMessage,
      timestamp: Date.now()
    } as ServerToClientMessage);
  }

  /**
   * 룸의 모든 클라이언트에게 브로드캐스트
   * Phase 3: 메시지 전송 최적화 - 연결 상태 확인 후 전송, 실패한 연결 정리
   */
  broadcastToRoom(roomCode: string, message: ServerToClientMessage, excludeClientId?: string): void {
    const clientIds = signalingStore.getRoomClients(roomCode);
    const messageStr = JSON.stringify(message); // 한 번만 직렬화
    
    for (const clientId of clientIds) {
      if (clientId === excludeClientId) {
        continue;
      }

      const connection = signalingStore.getConnection(clientId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(messageStr);
        } catch (error) {
          console.error(`[Online DAW] Failed to broadcast to client ${clientId}:`, error);
          // 전송 실패 시 연결 정리
          signalingStore.removeConnection(clientId);
        }
      } else {
        // 연결이 열려있지 않으면 정리
        if (connection) {
          signalingStore.removeConnection(clientId);
        }
      }
    }
  }

  /**
   * 특정 클라이언트에게 메시지 전송
   * Phase 3: 메시지 전송 최적화 - 연결 상태 확인 후 전송
   */
  sendToClient(clientId: string, message: ServerToClientMessage): void {
    const connection = signalingStore.getConnection(clientId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[Online DAW] Failed to send message to client ${clientId}:`, error);
        // 전송 실패 시 연결 정리
        signalingStore.removeConnection(clientId);
      }
    } else {
      // 연결이 열려있지 않으면 정리
      if (connection) {
        signalingStore.removeConnection(clientId);
      }
    }
  }

  /**
   * Phase 3: 오래된 연결 정리
   * 주기적으로 호출하여 dead connection을 정리합니다.
   */
  cleanupDeadConnections(): { cleaned: number; roomsDeleted: string[] } {
    const result = signalingStore.cleanupDeadConnections();
    
    // 호스트 연결이 끊어진 룸 삭제
    for (const roomCode of result.roomsDeleted) {
      const room = roomService.getRoom(roomCode);
      if (room) {
        // 모든 참가자에게 room-closed 알림
        this.notifyRoomClosed(roomCode);
        // 룸 삭제
        roomService.deleteRoom(roomCode);
        console.log(`[Online DAW] [${new Date().toISOString()}] Room deleted due to host connection closed: ${roomCode} (hostId: ${room.hostId})`);
      }
    }
    
    return result;
  }

  /**
   * 룸의 연결된 클라이언트 ID 목록 조회
   */
  getRoomClients(roomCode: string): string[] {
    return signalingStore.getRoomClients(roomCode);
  }

  /**
   * 룸의 모든 클라이언트 연결 정보 조회 (상세 정보 포함)
   */
  getRoomClientConnections(roomCode: string): Array<{
    clientId: string;
    role: 'host' | 'participant' | null;
    readyState: number;
    isOpen: boolean;
  }> {
    return signalingStore.getRoomClientConnections(roomCode);
  }

  /**
   * 룸의 모든 참가자에게 room-closed 메시지 전송
   */
  notifyRoomClosed(roomCode: string): void {
    const message: ServerToClientMessage = {
      action: 'room-closed',
      roomCode,
      data: {
        status: 'closed'
      },
      timestamp: Date.now()
    };
    
    // 호스트를 제외한 모든 참가자에게 전송
    const room = roomService.getRoom(roomCode);
    if (room) {
      for (const participantId of room.participants) {
        this.sendToClient(participantId, message);
      }
    }
    
    // 룸의 모든 클라이언트 연결 정리 (호스트 포함)
    const clientIds = signalingStore.getRoomClients(roomCode);
    for (const clientId of clientIds) {
      signalingStore.removeConnection(clientId);
    }
  }

  /**
   * 강퇴된 참가자에게 kicked 메시지 전송
   */
  notifyKicked(roomCode: string, participantId: string): void {
    const message: ServerToClientMessage = {
      action: 'kicked',
      roomCode,
      data: {
        status: 'kicked'
      },
      timestamp: Date.now()
    };
    
    // 강퇴된 참가자에게 메시지 전송
    this.sendToClient(participantId, message);
    
    // 강퇴된 참가자를 룸에서 제거 (signalingStore)
    const connection = signalingStore.getConnection(participantId);
    if (connection && connection.roomCode === roomCode) {
      signalingStore.removeConnection(participantId);
    }
  }
}

export const signalingService = new SignalingService();

