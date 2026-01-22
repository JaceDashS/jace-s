/**
 * 에러 처리 유틸리티
 * Phase 4: 서버 에러 처리 개선
 */

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/**
 * 에러 코드 정의
 */
export enum ErrorCode {
  // 400 Bad Request
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_ROOM_CODE = 'INVALID_ROOM_CODE',
  INVALID_HOST_ID = 'INVALID_HOST_ID',
  INVALID_PARTICIPANT_ID = 'INVALID_PARTICIPANT_ID',
  INVALID_DURATION = 'INVALID_DURATION',
  
  // 403 Forbidden
  UNAUTHORIZED = 'UNAUTHORIZED',
  KICKED = 'KICKED',
  
  // 404 Not Found
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  PARTICIPANT_NOT_FOUND = 'PARTICIPANT_NOT_FOUND',
  
  // 409 Conflict
  ROOM_FULL = 'ROOM_FULL',
  NO_AVAILABLE_ROOM_CODES = 'NO_AVAILABLE_ROOM_CODES',
  
  // 500 Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(
  error: string,
  code?: ErrorCode,
  status: number = 500,
  details?: unknown
): { response: ApiError; status: number } {
  return {
    response: {
      success: false,
      error,
      code,
      details
    },
    status
  };
}

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T>(data?: T): ApiSuccess<T> {
  return {
    success: true,
    data
  };
}

/**
 * 에러 로깅 (상세 정보 포함)
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[Online Sequencer] [ERROR] [${context}]`, {
    message: errorMessage,
    stack: errorStack,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
}

/**
 * 입력 검증 에러
 */
export function createValidationError(field: string, reason: string): { response: ApiError; status: number } {
  return createErrorResponse(
    `Invalid ${field}: ${reason}`,
    ErrorCode.INVALID_INPUT,
    400,
    { field, reason }
  );
}

