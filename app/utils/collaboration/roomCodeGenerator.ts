/**
 * 룸 코드 생성 유틸리티
 * 서버가 0000-9999 범위에서 임의로 룸 코드를 생성합니다.
 */

/**
 * 사용 가능한 룸 코드를 생성합니다.
 * 
 * @param usedCodes - 이미 사용 중인 룸 코드 Set
 * @returns 사용 가능한 4자리 룸 코드 (0000-9999)
 * @throws Error - 모든 룸 코드가 사용 중인 경우
 */
export function generateRoomCode(usedCodes: Set<string>): string {
  const min = 0;
  const max = 9999;
  const maxAttempts = 1000; // 최대 시도 횟수
  
  for (let i = 0; i < maxAttempts; i++) {
    // 0000-9999 사이의 임의 숫자 생성
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    const roomCode = code.toString().padStart(4, '0'); // 4자리로 패딩 (예: 42 -> "0042")
    
    if (!usedCodes.has(roomCode)) {
      return roomCode;
    }
  }
  
  // 모든 룸 코드가 사용 중인 경우 (매우 드문 상황)
  throw new Error('No available room codes');
}

/**
 * 룸 코드 형식 검증
 * 
 * @param roomCode - 검증할 룸 코드
 * @returns 유효한 룸 코드인지 여부
 */
export function isValidRoomCode(roomCode: string): boolean {
  // 4자리 숫자만 허용
  return /^\d{4}$/.test(roomCode);
}

