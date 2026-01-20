import { NextRequest, NextResponse } from 'next/server';
import { setCorsHeaders, handleOptions } from '../../utils/corsUtils';
import { withApiLogging } from '../../utils/apiLogger';

/**
 * 클라이언트에게 런타임 환경 변수를 제공하는 API 엔드포인트
 * 
 * NEXT_PUBLIC_* 변수는 빌드 타임에 번들에 포함되므로,
 * 런타임에 변경할 수 없습니다.
 * 
 * 이 엔드포인트는 런타임 환경 변수(ASSETS_URL 등)를
 * 클라이언트에게 제공합니다.
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/config', async () => {
    try {
    // 서버 사이드에서만 접근 가능한 환경 변수 사용
    const assetsUrl = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || '';
    
    // URL 끝의 슬래시 제거
    const cleanAssetsUrl = assetsUrl.replace(/\/$/, '');
    
    const response = NextResponse.json({
      assetsUrl: cleanAssetsUrl,
      // 필요시 다른 런타임 설정 추가 가능
    });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error('[api/config]', 'error', {
      error: error instanceof Error ? error.message : String(error),
      ts: Date.now(),
    });
    
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

