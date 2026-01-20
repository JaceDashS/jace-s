import { NextRequest, NextResponse } from 'next/server';
import { getCommentHistory } from '../../../../services/commentService';
import { setCorsHeaders, handleOptions } from '../../../../utils/corsUtils';
import { withApiLogging } from '../../../../utils/apiLogger';
import type { CommentResponse } from '../../../../types/comment';

// Route Segment Config - DB 연결이 있으므로 동적 렌더링
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 댓글 히스토리 조회 API
 * GET /api/comments/:id/history
 * 특정 댓글의 수정 히스토리를 조회합니다.
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const commentId = resolvedParams.id;
  return withApiLogging(request, `/api/comments/${commentId}/history`, async () => {
    try {
    // ID 검증
    const commentId = parseInt(resolvedParams.id, 10);
    if (isNaN(commentId) || commentId < 1) {
      const errorResponse = NextResponse.json(
        { error: '유효하지 않은 댓글 ID입니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // 댓글 히스토리 조회
    const history = await getCommentHistory(commentId);

    // 필드 매핑: 서버 필드 → 클라이언트 필드
    const mappedHistory: CommentResponse[] = history.map((item) => ({
      id: item.id,
      parentHeaderId: item.parentHeaderId,
      content: item.content,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
      isEdited: item.isEdited,
      isDeleted: item.isDeleted,
      version: item.version,
      editedCommentId: item.editedCommentId,
      headerId: item.headerId,
      tailId: item.tailId,
      hashedUser: item.hashedUserIP,
    }));

    const response = NextResponse.json(
      { history: mappedHistory },
      { status: 200 }
    );
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error('[API ERROR] 댓글 히스토리 조회 중 오류:', error);

    // 에러 메시지에 따라 적절한 상태 코드 반환
    if (error instanceof Error) {
      if (error.message.includes('찾을 수 없습니다')) {
        const errorResponse = NextResponse.json(
          { error: error.message },
          { status: 404 }
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
        error: 'Failed to get comment history',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

