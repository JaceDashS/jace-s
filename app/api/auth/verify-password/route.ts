import type { NextRequest } from 'next/server';
import {
  OPTIONS as adminLoginOptions,
  POST as adminLogin,
} from '../admin/login/route';

// Route Segment Config - 환경변수에 의존하므로 동적 렌더링
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(request: NextRequest) {
  return adminLoginOptions(request);
}

/**
 * 기존 클라이언트 호환용 deprecated 경로입니다.
 * 실제 로그인 동작은 관리자 로그인 API로 위임하며, 더 이상 valid 응답을 반환하지 않습니다.
 */
export async function POST(request: NextRequest) {
  const response = await adminLogin(request);
  response.headers.set('Deprecation', 'true');
  response.headers.set('Link', '</api/auth/admin/login>; rel="successor-version"');
  return response;
}
