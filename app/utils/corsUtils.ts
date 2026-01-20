import { NextRequest, NextResponse } from 'next/server';
import { logDebug, logInfo } from './logging';

/**
 * URL에서 origin 추출
 */
function extractOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.origin; // https://example.com
  } catch {
    return null;
  }
}

/**
 * 환경 변수에서 모든 CORS 허용 origin을 찾아 목록과 상세 정보 가져오기
 */
function getAllowedOriginsFromEnv(): {
  origins: string[];
  envEntries: Array<{ key: string; urls: string[]; origins: string[] }>;
  corsMode: string | null;
  isDevMode: boolean;
} {
  const origins = new Set<string>();
  const envEntries: Array<{ key: string; urls: string[]; origins: string[] }> = [];
  
  // CORS_MODE 확인
  const corsMode = process.env.CORS_MODE || null;
  const isDevMode = corsMode === 'dev';
  
  // 1. EXTERNAL_SERVICE_*_SERVER_URL 패턴 찾기
  const prefix = 'EXTERNAL_SERVICE_';
  const serverUrlSuffix = '_SERVER_URL';
  const urlSuffix = '_URL';
  
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith(prefix)) {
      // EXTERNAL_SERVICE_*_SERVER_URL 또는 EXTERNAL_SERVICE_*_URL 패턴 확인
      const isServerUrl = key.endsWith(serverUrlSuffix);
      const isUrl = key.endsWith(urlSuffix) && !key.endsWith(serverUrlSuffix);
      
      if (isServerUrl || isUrl) {
        const urlValue = process.env[key];
        if (urlValue) {
          // 콤마로 구분된 여러 URL 지원
          const urls = urlValue.split(',').map(u => u.trim()).filter(Boolean);
          const extractedOrigins: string[] = [];
          
          urls.forEach(url => {
            const origin = extractOrigin(url);
            if (origin) {
              origins.add(origin);
              extractedOrigins.push(origin);
            }
          });
          
          if (extractedOrigins.length > 0) {
            envEntries.push({
              key,
              urls,
              origins: extractedOrigins,
            });
          }
        }
      }
    }
  });
  
  // 2. ALLOWED_ORIGINS 환경변수 확인
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const urls = allowedOrigins.split(',').map(u => u.trim()).filter(Boolean);
    const extractedOrigins: string[] = [];
    
    urls.forEach(url => {
      const origin = extractOrigin(url);
      if (origin) {
        origins.add(origin);
        extractedOrigins.push(origin);
      }
    });
    
    if (extractedOrigins.length > 0) {
      envEntries.push({
        key: 'ALLOWED_ORIGINS',
        urls,
        origins: extractedOrigins,
      });
    }
  }
  
  // 3. GPT_VISUALIZER_CLIENT 환경변수 확인
  const gptVisualizerClient = process.env.GPT_VISUALIZER_CLIENT;
  if (gptVisualizerClient) {
    const urls = gptVisualizerClient.split(',').map(u => u.trim()).filter(Boolean);
    const extractedOrigins: string[] = [];
    
    urls.forEach(url => {
      const origin = extractOrigin(url);
      if (origin) {
        origins.add(origin);
        extractedOrigins.push(origin);
      }
    });
    
    if (extractedOrigins.length > 0) {
      envEntries.push({
        key: 'GPT_VISUALIZER_CLIENT',
        urls,
        origins: extractedOrigins,
      });
    }
  }
  
  return {
    origins: Array.from(origins),
    envEntries,
    corsMode,
    isDevMode,
  };
}

// 서버 시작 시 CORS 허용 목록 로그 출력
let hasLoggedStartup = false;
export function logCorsStartup() {
  if (hasLoggedStartup) return;
  hasLoggedStartup = true;
  
  const { origins, envEntries, corsMode, isDevMode } = getAllowedOriginsFromEnv();
  
  logInfo('[CORS] ========================================');
  logInfo('[CORS] CORS Allowed Origins (Server Startup)');
  logInfo('[CORS] ========================================');
  
  // CORS_MODE 표시
  if (corsMode) {
    logInfo(`[CORS] CORS_MODE: ${corsMode}`);
    if (isDevMode) {
      logInfo('[CORS] ⚠️  DEV MODE: All origins are allowed');
    }
    logInfo('[CORS]');
  }
  
  if (envEntries.length === 0) {
    if (isDevMode) {
      logInfo('[CORS] No specific origin restrictions (DEV MODE)');
      logInfo('[CORS] All origins will be allowed');
    } else {
      logInfo('[CORS] No CORS environment variables found');
      logInfo('[CORS] CORS will only allow same-origin requests');
    }
  } else {
    logInfo('[CORS] Environment Variables:');
    envEntries.forEach((entry) => {
      logInfo(`[CORS]   ${entry.key}:`);
      logInfo(`[CORS]     URLs: ${entry.urls.join(', ')}`);
      logInfo(`[CORS]     Extracted Origins: ${entry.origins.join(', ')}`);
    });
    logInfo('[CORS]');
    logInfo('[CORS] Total Allowed Origins:', { origins: Array.from(origins) });
    logInfo('[CORS] Count:', { count: origins.length });
    
    if (isDevMode) {
      logInfo('[CORS] ⚠️  Note: DEV MODE is enabled, so ALL origins are allowed');
      logInfo('[CORS]    (The above list is informational only)');
    }
  }
  
  logInfo('[CORS] ========================================');
}

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
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin');
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

