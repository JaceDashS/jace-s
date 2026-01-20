/**
 * Next.js Instrumentation Hook
 * 서버가 시작될 때 한 번만 실행됩니다.
 * ECS/Docker 로그에서 확인할 수 있습니다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 서버 사이드에서만 실행
    const { logCorsStartup } = await import('./app/utils/corsUtils');
    logCorsStartup();
  }
}

