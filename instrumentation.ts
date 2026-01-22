/**
 * Next.js Instrumentation Hook
 * 서버가 시작될 때 한 번만 실행됩니다.
 * ECS/Docker 로그에서 확인할 수 있습니다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 서버 사이드에서만 실행
    const { logCorsStartup } = await import('./app/utils/corsOrigins');
    logCorsStartup();
    
    // LOG_LEVEL=debug일 때만 환경 변수 로그 출력 (ECS 로그에서 확인 가능)
    const { logDebug } = await import('./app/utils/logging');
    logDebug('=== Environment Variables (Build-time) ===', {
      NEXT_PUBLIC_ASSETS_URL: process.env.NEXT_PUBLIC_ASSETS_URL || '(not set)',
      NEXT_PUBLIC_INSTAGRAM_URL: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '(not set)',
      NEXT_PUBLIC_GITHUB_URL: process.env.NEXT_PUBLIC_GITHUB_URL || '(not set)',
      NEXT_PUBLIC_EMAIL: process.env.NEXT_PUBLIC_EMAIL || '(not set)',
    });
  }
}

