import { logInfo } from './logging';

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
  envEntries: Array<{ key: string; urls: string[]; origins: string[] }>;
  corsMode: string | null;
  isDevMode: boolean;
} {
  const origins = new Set<string>();
  const envEntries: Array<{ key: string; urls: string[]; origins: string[] }> = [];

  const corsMode = process.env.CORS_MODE || null;
  const isDevMode = corsMode === 'dev' || process.env.NODE_ENV === 'development';

  const prefix = 'EXTERNAL_SERVICE_';
  const serverUrlSuffix = '_SERVER_URL';
  const urlSuffix = '_URL';

  Object.keys(process.env).forEach((key) => {
    if (key.startsWith(prefix)) {
      const isServerUrl = key.endsWith(serverUrlSuffix);
      const isUrl = key.endsWith(urlSuffix) && !key.endsWith(serverUrlSuffix);

      if (isServerUrl || isUrl) {
        const urlValue = process.env[key];
        if (urlValue) {
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

let hasLoggedStartup = false;
export function logCorsStartup() {
  if (hasLoggedStartup) return;
  hasLoggedStartup = true;

  const { origins, envEntries, corsMode, isDevMode } = getAllowedOriginsFromEnv();

  logInfo('[CORS] ========================================');
  logInfo('[CORS] CORS Allowed Origins (Server Startup)');
  logInfo('[CORS] ========================================');

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    logInfo('[CORS] 🚀 DEVELOPMENT MODE: All origins are allowed');
    logInfo('[CORS]');
  }

  if (corsMode) {
    logInfo(`[CORS] CORS_MODE: ${corsMode}`);
    if (isDevMode && !isDevelopment) {
      logInfo('[CORS] ⚠️  DEV MODE: All origins are allowed');
    }
    logInfo('[CORS]');
  }

  if (envEntries.length === 0) {
    if (isDevelopment || isDevMode) {
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

    if (isDevelopment) {
      logInfo('[CORS] ⚠️  Note: DEVELOPMENT MODE is enabled, so ALL origins are allowed');
      logInfo('[CORS]    (The above list is informational only)');
    } else if (isDevMode) {
      logInfo('[CORS] ⚠️  Note: DEV MODE (CORS_MODE=dev) is enabled, so ALL origins are allowed');
      logInfo('[CORS]    (The above list is informational only)');
    }
  }

  logInfo('[CORS] ========================================');
}

