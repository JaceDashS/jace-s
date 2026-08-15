export const CORS_ALLOW_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
export const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Forwarded-For, X-Origin, X-Client-Id, X-Host-Id';

export interface CorsPolicy {
  origins: string[];
  envEntries: Array<{ key: string; origins: string[] }>;
  corsMode: string | null;
  isDevMode: boolean;
}

export interface CorsPolicyInput {
  allowedOrigins?: string;
  gptVisualizerClient?: string;
  corsMode?: string | null;
  nodeEnv?: string;
}

function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createCorsPolicy({
  allowedOrigins,
  gptVisualizerClient,
  corsMode = null,
  nodeEnv,
}: CorsPolicyInput): CorsPolicy {
  const origins = new Set<string>();
  const envEntries: Array<{ key: string; origins: string[] }> = [];
  const isDevMode = corsMode === 'dev' || nodeEnv === 'development';

  const addOriginEntry = (key: string, value: string | undefined) => {
    if (!value) return;

    const extractedOrigins = value
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map(extractOrigin)
      .filter((origin): origin is string => origin !== null);

    extractedOrigins.forEach((origin) => origins.add(origin));

    if (extractedOrigins.length > 0) {
      envEntries.push({ key, origins: extractedOrigins });
    }
  };

  addOriginEntry('ALLOWED_ORIGINS', allowedOrigins);
  addOriginEntry('GPT_VISUALIZER_CLIENT', gptVisualizerClient);

  return {
    origins: Array.from(origins),
    envEntries,
    corsMode,
    isDevMode,
  };
}

export function getCorsHeadersForPolicy(
  origin: string | null,
  policy: CorsPolicy
): Record<string, string> {
  if (!origin || (!policy.isDevMode && !policy.origins.includes(origin))) {
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
