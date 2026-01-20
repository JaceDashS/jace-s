import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * package.json에서 버전 정보를 읽어옵니다.
 * Next.js standalone 빌드에서는 package.json이 복사되지 않을 수 있으므로
 * 여러 경로를 시도합니다.
 */
function getPackageVersion(): string {
  const possiblePaths = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), '..', 'package.json'),
    join(__dirname, '..', '..', 'package.json'),
  ];

  for (const packagePath of possiblePaths) {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      if (packageJson.version) {
        return packageJson.version;
      }
    } catch {
      // 다음 경로 시도
      continue;
    }
  }

  // 모든 경로에서 읽을 수 없는 경우
  return 'unknown';
}

/**
 * 서버 헬스체크 API
 * - 서버가 실행 중인지 확인하는 엔드포인트
 * - 운영 환경 모니터링, Kubernetes/Docker Health Check, 로드밸런서 등에서 사용
 * 
 * @route GET /health
 * @returns { 
 *   status: string, 
 *   version: string, 
 *   buildVersion: string,
 *   mode: string, 
 *   nodeEnv: string, 
 *   timestamp: string,
 *   uptime: number
 * }
 */
export async function GET() {
  const isDev = process.env.CORS_MODE === 'dev';
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // 환경 변수에서 빌드 시 주입된 버전 (우선순위 높음)
  const buildVersion = process.env.APP_VERSION || process.env.VERSION || 'unknown';
  
  // package.json에서 읽은 버전 (fallback)
  const packageVersion = getPackageVersion();
  
  // 최종 버전 결정: 빌드 버전이 있으면 사용, 없으면 package.json 버전
  const version = buildVersion !== 'unknown' ? buildVersion : packageVersion;
  
  // 서버 시작 시간 (process.uptime() 사용)
  const uptime = Math.floor(process.uptime());
  
  return NextResponse.json({
    status: 'OK',
    version: version,
    buildVersion: buildVersion,
    packageVersion: packageVersion,
    mode: isDev ? 'dev' : 'production',
    nodeEnv: nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: uptime, // 초 단위
    uptimeFormatted: formatUptime(uptime),
  });
}

/**
 * 초 단위 uptime을 읽기 쉬운 형식으로 변환
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

