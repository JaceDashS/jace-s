import { NextRequest, NextResponse } from 'next/server';
import { deleteComment, updateComment } from '../../../services/commentService';
import { getClientIP } from '../../../utils/requestUtils';
import { getHashedIP } from '../../../utils/hashUtils';
import { setCorsHeaders, handleOptions } from '../../../utils/corsUtils';
import { withApiLogging } from '../../../utils/apiLogger';

// Route Segment Config - DB 연결이 있으므로 동적 렌더링
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 댓글 삭제 API
 * DELETE /api/comments/:id
 * 댓글을 삭제합니다. 실제로 삭제하지 않고 IS_DELETED 플래그를 설정합니다.
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const commentId = resolvedParams.id;
  return withApiLogging(request, `/api/comments/${commentId}`, async () => {
    try {
    const body = await request.json();
    const { userPassword } = body;

    // 필수 필드 검증
    if (!userPassword || typeof userPassword !== 'string' || userPassword.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { error: 'userPassword는 필수입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // ID 검증
    const commentId = parseInt(resolvedParams.id, 10);
    if (isNaN(commentId) || commentId < 1) {
      const errorResponse = NextResponse.json(
        { error: '유효하지 않은 댓글 ID입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // 클라이언트 IP 가져오기 및 해싱
    const clientIP = getClientIP(request);
    const hashedUserIP = getHashedIP(clientIP);

    // 댓글 삭제
    const deletedId = await deleteComment(commentId, userPassword, hashedUserIP);

    const response = NextResponse.json(
      { id: deletedId },
      { status: 200 }
    );
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error('[API ERROR] 댓글 삭제 중 오류:', error);

    // 에러 메시지에 따라 적절한 상태 코드 반환
    if (error instanceof Error) {
      if (error.message.includes('존재하지 않는')) {
        const errorResponse = NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      if (error.message.includes('비밀번호') || error.message.includes('삭제된') || error.message.includes('수정된')) {
        const errorResponse = NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      if (error.message.includes('환경 변수가 설정되지 않았습니다')) {
        const errorResponse = NextResponse.json(
          {
            error: 'Database configuration error',
            details: 'DB 환경 변수가 설정되지 않았습니다.',
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
          },
          { status: 500 }
        );
        return setCorsHeaders(request, errorResponse);
      }
    }

    const errorResponse = NextResponse.json(
      {
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

/**
 * 댓글 수정 API
 * PUT /api/comments/:id
 * 기존 댓글을 수정합니다. 수정 시 새로운 레코드가 생성되어 히스토리가 유지됩니다.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const commentId = resolvedParams.id;
  return withApiLogging(request, `/api/comments/${commentId}`, async () => {
    try {
    const body = await request.json();
    const { content, userPassword, newHashedUserIP } = body;

    // 필수 필드 검증
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { error: 'content는 필수입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    if (!userPassword || typeof userPassword !== 'string' || userPassword.trim().length === 0) {
      const errorResponse = NextResponse.json(
        { error: 'userPassword는 필수입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // ID 검증
    const commentId = parseInt(resolvedParams.id, 10);
    if (isNaN(commentId) || commentId < 1) {
      const errorResponse = NextResponse.json(
        { error: '유효하지 않은 댓글 ID입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // 클라이언트 IP 가져오기 및 해싱 (newHashedUserIP가 제공되면 사용, 아니면 현재 IP 사용)
    let hashedUserIP: string;
    if (newHashedUserIP && typeof newHashedUserIP === 'string') {
      hashedUserIP = newHashedUserIP;
    } else {
      const clientIP = getClientIP(request);
      hashedUserIP = getHashedIP(clientIP);
    }

    // 댓글 수정
    const newId = await updateComment(commentId, content.trim(), userPassword, hashedUserIP);

    const response = NextResponse.json(
      { id: newId },
      { status: 200 }
    );
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error('[API ERROR] 댓글 수정 중 오류:', error);

    // 에러 메시지에 따라 적절한 상태 코드 반환
    if (error instanceof Error) {
      if (error.message.includes('존재하지 않는')) {
        const errorResponse = NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      if (error.message.includes('비밀번호') || error.message.includes('삭제된') || error.message.includes('수정된')) {
        const errorResponse = NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      if (error.message.includes('환경 변수가 설정되지 않았습니다')) {
        const errorResponse = NextResponse.json(
          {
            error: 'Database configuration error',
            details: 'DB 환경 변수가 설정되지 않았습니다.',
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
          },
          { status: 500 }
        );
        return setCorsHeaders(request, errorResponse);
      }
    }

    const errorResponse = NextResponse.json(
      {
        error: 'Failed to update comment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

