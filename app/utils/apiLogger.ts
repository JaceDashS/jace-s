import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from './requestUtils';
import { isVerboseLoggingEnabled, logDebug, logError, logInfo } from './logging';

/**
 * API 요청 로깅 유틸리티
 */
export interface ApiLogContext {
  method: string;
  path: string;
  origin: string;
  xOrigin: string | null;
  ip: string;
  userAgent: string | null;
  requestBody?: unknown;
  statusCode?: number;
  error?: string;
  duration?: number;
}

/**
 * API 요청 시작 로그
 */
export function logApiRequest(request: NextRequest, path: string): ApiLogContext {
  const origin = request.headers.get('origin');
  const xOrigin = request.headers.get('x-origin');
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent');
  const method = request.method;
  const actualOrigin = origin || xOrigin || '(same-origin)';

  const context: ApiLogContext = {
    method,
    path,
    origin: actualOrigin,
    xOrigin,
    ip,
    userAgent: userAgent || '(no user-agent)',
  };

  logDebug('[API] Request:', {
    method: context.method,
    path: context.path,
    origin: context.origin,
    xOrigin: context.xOrigin,
    ip: context.ip,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString(),
  });

  return context;
}

/**
 * API 요청 성공 로그
 */
export function logApiSuccess(context: ApiLogContext, statusCode: number, duration: number): void {
  const logData: Record<string, unknown> = {
    method: context.method,
    path: context.path,
    origin: context.origin,
    xOrigin: context.xOrigin,
    ip: context.ip,
    outcome: getOutcome(statusCode),
    statusCode,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  };

  if (context.requestBody !== undefined) {
    logData.body = context.requestBody;
  }

  logInfo('[API] Success:', logData);
}

/**
 * API 요청 실패 로그
 */
export function logApiError(
  context: ApiLogContext,
  statusCode: number,
  error: Error | string,
  duration: number
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logError('[API] Error:', {
    method: context.method,
    path: context.path,
    origin: context.origin,
    xOrigin: context.xOrigin,
    ip: context.ip,
    outcome: getOutcome(statusCode),
    statusCode,
    error: errorMessage,
    stack: errorStack,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  });
}

function getOutcome(statusCode: number): 'success' | 'redirect' | 'denied' | 'error' {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'denied';
  if (statusCode >= 300) return 'redirect';
  return 'success';
}

async function getErrorReason(response: NextResponse): Promise<string | undefined> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.clone().json();
      if (body && typeof body === 'object') {
        const error = (body as { error?: string }).error;
        const details = (body as { details?: string }).details;
        return error || details;
      }
    }
    const text = await response.clone().text();
    return text ? text.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * API 요청 래퍼 함수
 * 요청 시작/종료 시간을 자동으로 추적하고 로깅합니다.
 */
export async function withApiLogging(
  request: NextRequest,
  path: string,
  handler: (context: ApiLogContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const context = logApiRequest(request, path);

  // POST, PUT, PATCH 요청의 경우 body를 미리 읽어서 로그에 포함
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method) && request.body) {
    try {
      const clonedRequest = request.clone();
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        context.requestBody = await clonedRequest.json();
      } else {
        const text = await clonedRequest.text();
        // body가 너무 길면 잘라서 표시 (10KB 제한)
        context.requestBody = text.length > 10240 ? `${text.slice(0, 10240)}... (truncated)` : text;
      }
    } catch {
      // body 읽기 실패는 무시 (로그에만 포함)
      context.requestBody = '(failed to parse body)';
    }
  }

  try {
    const response = await handler(context);
    const duration = Date.now() - startTime;
    const statusCode = response.status;
    const outcome = getOutcome(statusCode);

    if (outcome === 'success' || outcome === 'redirect') {
      if (isVerboseLoggingEnabled()) {
        logApiSuccess(context, statusCode, duration);
      }
    } else {
      const errorReason = await getErrorReason(response);
      logApiError(context, statusCode, errorReason || `HTTP ${statusCode}`, duration);
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500;
    logApiError(context, statusCode, error instanceof Error ? error : String(error), duration);

    // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
    throw error;
  }
}

