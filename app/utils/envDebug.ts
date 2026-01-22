/**
 * 환경변수 디버깅 유틸리티
 * 어떤 환경변수가 사용되고 있는지 확인
 */

import { isVerboseLoggingEnabled, logDebug } from './logging';

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
    logDebug('=== Server-side Environment Variables ===');
    logDebug(`NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
    logDebug(`NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || '(not set)'}`);
    logDebug(`NEXT_PUBLIC_ASSETS_URL: ${process.env.NEXT_PUBLIC_ASSETS_URL || '(not set)'}`);
    logDebug(`SERVER_API_URL: ${process.env.SERVER_API_URL || '(not set)'}`);
    return;
  }

  // 클라이언트 사이드
  logDebug('=== Client-side Environment Variables ===');
  logDebug(`NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
  
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

  if (isVerboseLoggingEnabled()) {
    console.table(envVars.map(env => ({
    Variable: env.variable,
    Value: env.value || '(not set)',
    'Has Value': env.hasValue ? '✓' : '✗',
    Source: env.source,
  })));
  }

  // 상세 정보
  envVars.forEach(env => {
    if (env.hasValue) {
      logDebug(`✓ ${env.variable}: ${env.value || '(not set)'}`);
    } else {
      logDebug(`✗ ${env.variable}: Not set`);
    }
  });

  // window.location 정보
  logDebug('\n=== Current Window Location ===');
  logDebug(`Origin: ${window.location.origin}`);
  logDebug(`Host: ${window.location.host}`);
  logDebug(`Protocol: ${window.location.protocol}`);
}

// 환경변수 디버깅 플래그 (한 번만 로그 출력)
const envValueDebugLogged: Set<string> = new Set();

/**
 * 특정 환경변수의 값을 안전하게 가져오기
 */
export function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  if (!envValueDebugLogged.has(key)) {
    logDebug(`[ENV DEBUG] ${key}: ${value || '(not set)'}`);
    envValueDebugLogged.add(key);
  }
  return value;
}



