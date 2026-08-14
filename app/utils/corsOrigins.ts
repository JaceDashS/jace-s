import { logInfo } from './logging';
import { createCorsPolicy, getCorsHeadersForPolicy, type CorsPolicy } from './corsPolicy';

export function getAllowedOriginsFromEnv(): CorsPolicy {
  return createCorsPolicy({
    allowedOrigins: process.env.ALLOWED_ORIGINS,
    gptVisualizerClient: process.env.GPT_VISUALIZER_CLIENT,
    corsMode: process.env.CORS_MODE || null,
    nodeEnv: process.env.NODE_ENV,
  });
}

export function getCorsHeadersForOrigin(origin: string | null): Record<string, string> {
  return getCorsHeadersForPolicy(origin, getAllowedOriginsFromEnv());
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
