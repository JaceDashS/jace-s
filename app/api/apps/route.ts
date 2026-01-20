import { NextRequest, NextResponse } from 'next/server';
import { getAllApps } from '../../services/appService';
import { setCorsHeaders, handleOptions } from '../../utils/corsUtils';
import { withApiLogging } from '../../utils/apiLogger';

/**
 * Apps API Route - DB에 직접 연결하여 앱 목록 조회
 * jace-s는 독립적인 저장소이므로 Express 서버에 의존하지 않음
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/apps', async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      
      // 유효성 검사
      if (page < 1 || limit < 1) {
        const errorResponse = NextResponse.json(
          { error: 'page와 limit은 1 이상이어야 합니다.' },
          { status: 400 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      
      // DB에서 직접 앱 목록 가져오기
      const result = await getAllApps(page, limit);
      
      const response = NextResponse.json(result);
      return setCorsHeaders(request, response);
    } catch (error) {
      // DB 연결 에러인지 확인
      if (error instanceof Error) {
        if (error.message.includes('환경 변수가 설정되지 않았습니다')) {
          const errorResponse = NextResponse.json(
            { 
              error: 'Database configuration error',
              details: 'DB 환경 변수가 설정되지 않았습니다. DB_USER, DB_PASSWORD, DB_CONNECTION_STRING을 확인하세요.',
            },
            { status: 500 }
          );
          return setCorsHeaders(request, errorResponse);
        }
        
        if (error.message.includes('ORA-') || error.message.includes('Oracle')) {
          const errorResponse = NextResponse.json(
            { 
              error: 'Database connection error',
              details: error.message,
              suggestion: 'DB 연결 정보와 네트워크 연결을 확인하세요.',
            },
            { status: 500 }
          );
          return setCorsHeaders(request, errorResponse);
        }
      }
      
      const errorResponse = NextResponse.json(
        { 
          error: 'Failed to fetch apps',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
      return setCorsHeaders(request, errorResponse);
    }
  });
}

