/**
 * 환경변수 디버깅 유틸리티
 * 어떤 환경변수가 사용되고 있는지 확인
 */

interface EnvDebugInfo {
  variable: string;
  value: string | undefined;
  hasValue: boolean;
  source: 'runtime' | 'build-time';
}

/**
 * 환경변수 디버깅 정보 출력
 */
export function debugEnvironmentVariables(): void {
  if (typeof window === 'undefined') {
    // 서버 사이드
    console.log('=== Server-side Environment Variables ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('NEXT_PUBLIC_ASSETS_URL:', process.env.NEXT_PUBLIC_ASSETS_URL);
    console.log('SERVER_API_URL:', process.env.SERVER_API_URL);
    return;
  }

  // 클라이언트 사이드
  console.log('=== Client-side Environment Variables ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  const envVars: EnvDebugInfo[] = [
    {
      variable: 'NEXT_PUBLIC_BASE_URL',
      value: process.env.NEXT_PUBLIC_BASE_URL,
      hasValue: !!process.env.NEXT_PUBLIC_BASE_URL,
      source: 'build-time',
    },
    {
      variable: 'NEXT_PUBLIC_ASSETS_URL',
      value: process.env.NEXT_PUBLIC_ASSETS_URL,
      hasValue: !!process.env.NEXT_PUBLIC_ASSETS_URL,
      source: 'build-time',
    },
    {
      variable: 'SERVER_API_URL',
      value: process.env.SERVER_API_URL,
      hasValue: !!process.env.SERVER_API_URL,
      source: 'build-time',
    },
  ];

  console.table(envVars.map(env => ({
    Variable: env.variable,
    Value: env.value || '(not set)',
    'Has Value': env.hasValue ? '✓' : '✗',
    Source: env.source,
  })));

  // 상세 정보
  envVars.forEach(env => {
    if (env.hasValue) {
      console.log(`✓ ${env.variable}:`, env.value);
    } else {
      console.warn(`✗ ${env.variable}: Not set`);
    }
  });

  // window.location 정보
  console.log('\n=== Current Window Location ===');
  console.log('Origin:', window.location.origin);
  console.log('Host:', window.location.host);
  console.log('Protocol:', window.location.protocol);
}

// 환경변수 디버깅 플래그 (한 번만 로그 출력)
const envValueDebugLogged: Set<string> = new Set();

/**
 * 특정 환경변수의 값을 안전하게 가져오기
 */
export function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  if (!envValueDebugLogged.has(key)) {
    console.log(`[ENV DEBUG] ${key}:`, value || '(not set)');
    envValueDebugLogged.add(key);
  }
  return value;
}

