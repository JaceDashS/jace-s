/**
 * 룸 관리 서비스
 * 룸 생성, 조회, 수정, 삭제 등의 로직을 담당합니다.
 */

import type { Room } from '@/app/types/collaboration/room';
import { generateRoomCode } from '@/app/utils/collaboration/roomCodeGenerator';
import fs from 'fs';
import path from 'path';

type SerializedRoom = Omit<Room, 'kickedParticipants'> & {
  kickedParticipants: Array<[string, number]>;
};

const ROOM_DATA_DIR = path.resolve(process.cwd(), 'data');
const ROOM_DATA_FILE = path.join(ROOM_DATA_DIR, 'rooms.json');

function serializeRoom(room: Room): SerializedRoom {
  return {
    ...room,
    kickedParticipants: Array.from(room.kickedParticipants.entries()),
  };
}

function deserializeRoom(room: SerializedRoom): Room {
  return {
    ...room,
    kickedParticipants: new Map(room.kickedParticipants),
  };
}

/**
 * 룸 저장소 (인메모리)
 */
class RoomStore {
  private rooms = new Map<string, Room>();

  get(roomCode: string): Room | undefined {
    this.loadFromDisk();
    return this.rooms.get(roomCode);
  }

  set(roomCode: string, room: Room): void {
    this.loadFromDisk();
    this.rooms.set(roomCode, room);
    this.saveToDisk();
  }

  delete(roomCode: string): boolean {
    this.loadFromDisk();
    const deleted = this.rooms.delete(roomCode);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  getAll(): Room[] {
    this.loadFromDisk();
    return Array.from(this.rooms.values());
  }

  getAllRoomCodes(): Set<string> {
    this.loadFromDisk();
    return new Set(this.rooms.keys());
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(ROOM_DATA_FILE)) {
        this.rooms.clear();
        return;
      }
      const raw = fs.readFileSync(ROOM_DATA_FILE, 'utf-8');
      if (!raw.trim()) {
        this.rooms.clear();
        return;
      }
      const parsed = JSON.parse(raw) as SerializedRoom[];
      this.rooms = new Map(parsed.map((room) => [room.roomCode, deserializeRoom(room)]));
    } catch (error) {
      console.error('[Online DAW] [RoomStore] Failed to load rooms:', error);
      this.rooms.clear();
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(ROOM_DATA_DIR)) {
        fs.mkdirSync(ROOM_DATA_DIR, { recursive: true });
      }
      const data = Array.from(this.rooms.values()).map(serializeRoom);
      fs.writeFileSync(ROOM_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Online DAW] [RoomStore] Failed to save rooms:', error);
    }
  }
}

// 전역 변수로 roomStore 공유 (Next.js 모듈 시스템 문제 해결)
declare global {
  // eslint-disable-next-line no-var
  var __roomStore: RoomStore | undefined;
}

// 개발 모드에서는 HMR로 인해 모듈이 재로드될 수 있으므로 전역 변수 사용
const roomStore = globalThis.__roomStore || new RoomStore();
if (process.env.NODE_ENV === 'development') {
  globalThis.__roomStore = roomStore;
}

const MAX_ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

/**
 * 룸 서비스
 */
export class RoomService {
  private getActiveRoomsByHostId(hostId: string): Room[] {
    const now = Date.now();
    return roomStore.getAll()
      .filter((room) => room.hostId === hostId && now <= room.expiresAt)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  private pruneRoomsByHostId(hostId: string): Room | null {
    const rooms = this.getActiveRoomsByHostId(hostId);
    if (rooms.length === 0) {
      return null;
    }
    const keep = rooms[0];
    for (const room of rooms.slice(1)) {
      roomStore.delete(room.roomCode);
    }
    return keep;
  }

  /**
   * 룸 생성
   * 서버가 룸 코드를 생성하여 반환합니다.
   * 
   * @param hostId - 호스트 UUID
   * @param maxParticipants - 최대 참가자 수 (기본값: 4)
   * @returns 생성된 룸
   */
  createRoom(hostId: string, maxParticipants: number = 4): Room {
    const existingRoom = this.pruneRoomsByHostId(hostId);
    if (existingRoom) {
      return existingRoom;
    }

    // 사용 중인 룸 코드 조회
    const usedCodes = roomStore.getAllRoomCodes();
    
    // 서버가 룸 코드 생성 (0000-9999 범위에서 임의 선택)
    const roomCode = generateRoomCode(usedCodes);
    
    const now = Date.now();
    const expiresAt = now + MAX_ROOM_TTL_MS; // 6시간 후
    
    const room: Room = {
      roomCode,
      hostId,
      createdAt: now,
      expiresAt,
      allowJoin: false,
      allowJoinExpiresAt: null,
      participants: [],
      kickedParticipants: new Map(),
      maxParticipants
    };
    
    roomStore.set(roomCode, room);
    return room;
  }

  /**
   * 호스트 ID로 룸 조회
   * 
   * @param hostId - 호스트 UUID
   * @returns 룸 정보 또는 null
   */
  getRoomByHostId(hostId: string): Room | null {
    const rooms = roomStore.getAll();
    const now = Date.now();
    
    // 해당 호스트의 활성 룸 찾기 (가장 최근에 생성된 룸)
    const activeRooms = rooms
      .filter(room => room.hostId === hostId && now <= room.expiresAt)
      .sort((a, b) => b.createdAt - a.createdAt);
    
    return activeRooms.length > 0 ? activeRooms[0] : null;
  }

  /**
   * 룸 조회
   * 
   * @param roomCode - 룸 코드
   * @returns 룸 정보 또는 null
   */
  getRoom(roomCode: string): Room | null {
    console.log('[Online DAW] [RoomService] getRoom called:', { roomCode, totalRooms: roomStore.getAll().length });
    const room = roomStore.get(roomCode);
    if (!room) {
      console.log('[Online DAW] [RoomService] Room not found in store:', roomCode);
      console.log('[Online DAW] [RoomService] Available room codes:', Array.from(roomStore.getAllRoomCodes()));
      return null;
    }
    
    // 만료된 룸인지 확인
    const now = Date.now();
    if (now > room.expiresAt) {
      console.log('[Online DAW] [RoomService] Room expired:', { roomCode, now, expiresAt: room.expiresAt });
      return null;
    }
    
    console.log('[Online DAW] [RoomService] Room found:', { roomCode, allowJoin: room.allowJoin, participantCount: room.participants.length });
    return room;
  }

  /**
   * 조인 허용 활성화
   * 호스트가 언제든지 호출 가능하며, 만료 후에도 다시 호출하면 즉시 활성화됩니다.
   * 
   * @param roomCode - 룸 코드
   * @param duration - 조인 허용 지속 시간 (초 단위, 기본값: 60)
   */
  allowJoin(roomCode: string, duration: number = 60): void {
    const room = roomStore.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }
    
    const now = Date.now();
    const expiresAt = now + duration * 1000; // duration 초 후
    
    room.allowJoin = true;
    room.allowJoinExpiresAt = expiresAt;
    
    roomStore.set(roomCode, room);
  }

  /**
   * 참가자 추가
   * 
   * @param roomCode - 룸 코드
   * @param participantId - 참가자 UUID
   */
  addParticipant(roomCode: string, participantId: string): void {
    const room = roomStore.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }
    
    // 이미 참가 중인 경우 무시
    if (room.participants.includes(participantId)) {
      return;
    }
    
    // 최대 참가자 수 확인
    if (room.participants.length >= room.maxParticipants) {
      throw new Error('Room is full');
    }
    
    room.participants.push(participantId);
    roomStore.set(roomCode, room);
  }

  /**
   * 참가자 제거
   * 
   * @param roomCode - 룸 코드
   * @param participantId - 참가자 UUID
   */
  removeParticipant(roomCode: string, participantId: string): void {
    const room = roomStore.get(roomCode);
    if (!room) {
      return; // 룸이 없으면 무시
    }
    
    const index = room.participants.indexOf(participantId);
    if (index > -1) {
      room.participants.splice(index, 1);
      roomStore.set(roomCode, room);
    }
  }

  /**
   * 참가자 강퇴
   * 강퇴된 참가자는 같은 룸 인스턴스에 재조인할 수 없습니다.
   * 
   * @param roomCode - 룸 코드
   * @param participantId - 참가자 UUID
   */
  kickParticipant(roomCode: string, participantId: string): void {
    const room = roomStore.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }
    
    // 참가자 목록에서 제거
    this.removeParticipant(roomCode, participantId);
    
    // 강퇴 목록에 추가 (roomCreatedAt 저장)
    room.kickedParticipants.set(participantId, room.createdAt);
    
    roomStore.set(roomCode, room);
  }

  /**
   * 강퇴된 참가자인지 확인
   * 
   * @param roomCode - 룸 코드
   * @param participantId - 참가자 UUID
   * @returns 강퇴된 참가자인지 여부
   */
  isKickedParticipant(roomCode: string, participantId: string): boolean {
    const room = roomStore.get(roomCode);
    if (!room) {
      return false;
    }
    
    // 강퇴 목록에 있고, 같은 룸 인스턴스인지 확인
    const kickedAt = room.kickedParticipants.get(participantId);
    if (kickedAt === undefined) {
      return false;
    }
    
    // 같은 룸 인스턴스인지 확인 (createdAt 비교)
    return kickedAt === room.createdAt;
  }

  /**
   * 룸 삭제
   * 
   * @param roomCode - 룸 코드
   */
  deleteRoom(roomCode: string): void {
    roomStore.delete(roomCode);
  }

  /**
   * 만료된 룸 정리
   * 주기적으로 호출되어 만료된 룸을 삭제합니다.
   * 
   * @returns 삭제된 룸 코드 목록
   */
  cleanupExpiredRooms(): string[] {
    const now = Date.now();
    const rooms = roomStore.getAll();
    const deletedRoomCodes: string[] = [];
    
    for (const room of rooms) {
      if (now > room.expiresAt) {
        roomStore.delete(room.roomCode);
        deletedRoomCodes.push(room.roomCode);
      }
    }

    return deletedRoomCodes;
  }

  /**
   * 조인 허용 만료 확인 및 업데이트
   * 조인 허용 시간이 만료되면 자동으로 false로 변경합니다.
   * 
   * @param roomCode - 룸 코드
   */
  checkAndUpdateAllowJoin(roomCode: string): void {
    const room = roomStore.get(roomCode);
    if (!room) {
      return;
    }
    
    // allowJoin이 true이고 만료 시간이 지났으면 false로 변경
    if (room.allowJoin && room.allowJoinExpiresAt !== null) {
      if (Date.now() > room.allowJoinExpiresAt) {
        room.allowJoin = false;
        room.allowJoinExpiresAt = null;
        roomStore.set(roomCode, room);
      }
    }
  }

  /**
   * 모든 룸 조회 (내부용)
   */
  getAllRooms(): Room[] {
    return roomStore.getAll();
  }
}

// 전역 변수로 roomService 공유 (Next.js 모듈 시스템 문제 해결)
declare global {
  // eslint-disable-next-line no-var
  var __roomService: RoomService | undefined;
}

// 개발 모드에서는 HMR로 인해 모듈이 재로드될 수 있으므로 전역 변수 사용
const roomService = globalThis.__roomService || new RoomService();
if (process.env.NODE_ENV === 'development') {
  globalThis.__roomService = roomService;
}

export { roomService };

