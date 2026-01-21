import { NextRequest, NextResponse } from 'next/server';
import { setCorsHeaders, handleOptions } from '../../../utils/corsUtils';
import { withApiLogging } from '../../../utils/apiLogger';
import { comparePassword } from '../../../utils/passwordUtils';

// Route Segment Config - 환경변수에 의존하므로 동적 렌더링
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * CORS Preflight 요청 처리
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

/**
 * 비밀번호 검증 API
 * POST /api/auth/verify-password
 * 
 * 환경변수에 저장된 해시된 비밀번호와 입력된 비밀번호를 비교합니다.
 * comment API와 동일한 PEPPER와 규칙을 사용합니다.
 * 
 * Request Body:
 * {
 *   "password": "입력한 비밀번호"
 * }
 * 
 * Response:
 * {
 *   "valid": true/false
 * }
 */
export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/auth/verify-password', async () => {
    try {
      const body = await request.json();
      const { password } = body;

      // 필수 필드 검증
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        const errorResponse = NextResponse.json(
          { error: 'password는 필수입니다.' },
          { status: 400 }
        );
        return setCorsHeaders(request, errorResponse);
      }

      // 환경변수에서 해시된 비밀번호 가져오기
      const storedPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

      if (!storedPasswordHash) {
        const errorResponse = NextResponse.json(
          {
            error: 'Server configuration error',
            details: '환경 변수 ADMIN_PASSWORD_HASH가 설정되지 않았습니다.',
          },
          { status: 500 }
        );
        return setCorsHeaders(request, errorResponse);
      }

      // 비밀번호 비교 (comment API와 동일한 PEPPER 사용)
      const isValid = await comparePassword(password.trim(), storedPasswordHash);

      const response = NextResponse.json(
        { valid: isValid },
        { status: 200 }
      );
      return setCorsHeaders(request, response);
    } catch (error) {
      const errorResponse = NextResponse.json(
        {
          error: 'Failed to verify password',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
      return setCorsHeaders(request, errorResponse);
    }
  });
}

