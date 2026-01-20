import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // 모든 오리진 허용을 위한 CORS 헤더
  const response = NextResponse.next();

  // CORS 헤더 설정
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For');
  response.headers.set('Access-Control-Max-Age', '86400');

  // OPTIONS 요청에 대한 처리
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }

  return response;
}

// 프록시가 실행될 경로 설정 (모든 경로)
export const config = {
  matcher: '/:path*',
};

