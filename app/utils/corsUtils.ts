import { NextRequest, NextResponse } from 'next/server';
import { logDebug } from './logging';
import { getCorsHeadersForOrigin } from './corsOrigins';

/**
 * 허용된 클라이언트 Origin에만 CORS 헤더를 설정합니다.
 */
export async function setCorsHeaders(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const requestOrigin = request.headers.get('origin');
  const xOrigin = request.headers.get('x-origin');
  const requestPath = request.nextUrl.pathname;
  const requestMethod = request.method;
  const actualOrigin = requestOrigin || xOrigin || '(same-origin)';
  
  logDebug('[CORS] Processing request:', {
    path: requestPath,
    method: requestMethod,
    origin: actualOrigin,
    xOrigin,
  });
  
  // Origin 헤더가 없으면 (같은 origin 요청) CORS 헤더 불필요
  if (!requestOrigin) {
    logDebug('[CORS] No origin header, skipping CORS (same-origin request)');
    return response;
  }
  
  const corsHeaders = getCorsHeadersForOrigin(requestOrigin);
  if (Object.keys(corsHeaders).length > 0) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    logDebug('[CORS] CORS headers set for origin:', { requestOrigin });
  } else {
    logDebug('[CORS] Origin not allowed, CORS headers not set:', { requestOrigin });
  }
  
  return response;
}

/**
 * OPTIONS 요청 처리 (Preflight)
 */
export async function handleOptions(request: NextRequest): Promise<NextResponse> {
  logDebug('[CORS] Handling OPTIONS (preflight) request:', {
    path: request.nextUrl.pathname,
    origin: request.headers.get('origin'),
  });
  const corsHeaders = getCorsHeadersForOrigin(request.headers.get('origin'));
  const hasOrigin = request.headers.has('origin');
  const response = new NextResponse(null, {
    status: hasOrigin && Object.keys(corsHeaders).length === 0 ? 403 : 204,
  });

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
