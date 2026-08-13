import { logInfo } from './logging';

export const CORS_ALLOW_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
export const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin, X-Client-Id, X-Host-Id';

function extractOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return null;
  }
}

export function getAllowedOriginsFromEnv(): {
  origins: string[];
  envEntries: Array<{ key: string; origins: string[] }>;
  corsMode: string | null;
  isDevMode: boolean;
} {
  const origins = new Set<string>();
  const envEntries: Array<{ key: string; origins: string[] }> = [];

  const corsMode = process.env.CORS_MODE || null;
  const isDevMode = corsMode === 'dev' || process.env.NODE_ENV === 'development';

  const addOriginEntry = (key: string, value: string | undefined) => {
    if (!value) return;

    const extractedOrigins: string[] = [];
    value.split(',').map(u => u.trim()).filter(Boolean).forEach(url => {
      const origin = extractOrigin(url);
      if (origin) {
        origins.add(origin);
        extractedOrigins.push(origin);
      }
    });

    if (extractedOrigins.length > 0) {
      envEntries.push({
        key,
        origins: extractedOrigins,
      });
    }
  };

  // 클라이언트 Origin만 허용 목록에 추가하고, 외부 서비스 대상 URL은 제외합니다.
  addOriginEntry('ALLOWED_ORIGINS', process.env.ALLOWED_ORIGINS);
  addOriginEntry('GPT_VISUALIZER_CLIENT', process.env.GPT_VISUALIZER_CLIENT);

  return {
    origins: Array.from(origins),
    envEntries,
    corsMode,
    isDevMode,
  };
}

export function getCorsHeadersForOrigin(origin: string | null): Record<string, string> {
  if (!origin) return {};

  const { origins: allowedOrigins, isDevMode } = getAllowedOriginsFromEnv();
  if (!isDevMode && !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// CORS 시작 로그에는 설정 출처와 개수만 기록하고 실제 Origin 및 서비스 URL은 기록하지 않는다.
let hasLoggedStartup = false;
export function logCorsStartup() {
  if (hasLoggedStartup) return;
  hasLoggedStartup = true;

  const { origins, envEntries, corsMode, isDevMode } = getAllowedOriginsFromEnv();

  logInfo('[CORS] ========================================');
  logInfo('[CORS] CORS policy loaded');
  logInfo('[CORS] ========================================');

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    logInfo('[CORS] Development mode allows all origins');
  }

  if (corsMode) {
    logInfo(`[CORS] CORS_MODE: ${corsMode}`);
  }

  if (envEntries.length === 0) {
    logInfo('[CORS] No explicit client origins configured', {
      mode: isDevelopment || isDevMode ? 'development' : 'same-origin',
    });
  } else {
    logInfo('[CORS] Client origin sources configured', {
      keys: envEntries.map(entry => entry.key),
      originCount: origins.length,
    });
  }

  if (isDevMode) {
    logInfo('[CORS] Development policy allows all origins');
  }

  logInfo('[CORS] ========================================');
}
