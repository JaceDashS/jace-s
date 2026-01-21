/**
 * 룸 데이터 모델
 * 콜라보레이션 세션의 룸 정보를 나타냅니다.
 */

export interface Room {
  /** 서버가 생성한 4자리 숫자 (0000-9999) */
  roomCode: string;
  
  /** 호스트 UUID */
  hostId: string;
  
  /** 생성 시간 (timestamp) */
  createdAt: number;
  
  /** 만료 시간 (6시간 후, timestamp) */
  expiresAt: number;
  
  /** 조인 허용 여부 */
  allowJoin: boolean;
  
  /** 조인 허용 만료 시간 (60초 후, timestamp, null 가능) */
  allowJoinExpiresAt: number | null;
  
  /** 참가자 ID 목록 */
  participants: string[];
  
  /** 강퇴된 참가자 (participantId -> roomCreatedAt) */
  kickedParticipants: Map<string, number>;
  
  /** 최대 참가자 수 (기본값: 4) */
  maxParticipants: number;
}

export interface HostInfo {
  /** 호스트 UUID */
  hostId: string;
  
  /** 서버가 생성한 룸 코드 */
  roomCode: string;
}

/**
 * 룸 생성 요청 데이터
 */
export interface CreateRoomRequest {
  hostId: string;
}

/**
 * 룸 조회 응답 데이터
 */
export interface RoomInfo {
  success: boolean;
  roomCode: string;
  hostId: string;
  status: 'active' | 'expired' | 'inactive' | 'full';
  allowJoin: boolean;
  allowJoinExpiresAt: number | null;
  participantCount: number;
  maxParticipants: number;
  createdAt: number;
  expiresAt: number;
  error?: string;
  roomCreatedAt?: number;
}

/**
 * 조인 허용 활성화 요청 데이터
 */
export interface AllowJoinRequest {
  duration: number; // 초 단위 (기본값: 60)
}

/**
 * 조인 허용 활성화 응답 데이터
 */
export interface AllowJoinResponse {
  success: boolean;
  allowJoin: boolean;
  allowJoinExpiresAt: number;
  error?: string;
}

/**
 * 참가자 강퇴 요청 데이터
 */
export interface KickParticipantRequest {
  participantId: string;
}

/**
 * 참가자 강퇴 응답 데이터
 */
export interface KickParticipantResponse {
  success: boolean;
  message: string;
  error?: string;
}

