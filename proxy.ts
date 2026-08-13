import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCorsHeadersForOrigin } from './app/utils/corsOrigins';

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeadersForOrigin(origin);
  const isAllowedOrigin = !origin || Object.keys(corsHeaders).length > 0;
  const response = request.method === 'OPTIONS'
    ? new NextResponse(null, { status: isAllowedOrigin ? 204 : 403 })
    : isAllowedOrigin
      ? NextResponse.next()
      : new NextResponse(null, { status: 403 });

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// 프록시가 실행될 경로 설정 (모든 경로)
export const config = {
  matcher: '/:path*',
};
