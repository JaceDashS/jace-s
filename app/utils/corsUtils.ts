import { NextRequest, NextResponse } from 'next/server';
import { logDebug } from './logging';
import { getAllowedOriginsFromEnv } from './corsOrigins';

/**
 * CORS 헤더를 동적으로 설정
 * EXTERNAL_SERVICE_*_URL 환경 변수의 origin 목록을 기반으로 허용 여부 결정
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
  
  // 허용된 origin 목록 가져오기 (환경 변수에서)
  const { origins: allowedOrigins, isDevMode } = getAllowedOriginsFromEnv();
  
  logDebug('[CORS] Checking origin:', {
    requestOrigin,
    allowedOrigins,
    isDevMode,
    isAllowed: isDevMode || allowedOrigins.includes(requestOrigin),
  });
  
  // DEV 모드이거나 요청 origin이 허용 목록에 있으면 CORS 허용
  if (isDevMode || allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin, X-Client-Id, X-Host-Id');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    logDebug('[CORS] CORS headers set for origin:', { requestOrigin });
  } else {
    logDebug('[CORS] Origin not allowed, CORS headers not set:', {
      requestOrigin,
      allowedOrigins,
    });
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
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(request, response);
}

