import { NextRequest, NextResponse } from 'next/server';
import { getComments, createComment } from '../../services/commentService';
import { getClientIP } from '../../utils/requestUtils';
import { getHashedIP } from '../../utils/hashUtils';
import { setCorsHeaders, handleOptions } from '../../utils/corsUtils';
import { withApiLogging } from '../../utils/apiLogger';
import type { CommentResponse } from '../../types/comment';

type CommentRow = Awaited<ReturnType<typeof getComments>>['comments'][number];

// Route Segment Config - DB 연결이 있으므로 동적 렌더링
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 댓글 목록 조회 API
 * GET /api/comments
 * 부모 댓글과 해당 자식 댓글을 함께 조회 (페이지네이션)
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/comments', async () => {
    try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 유효성 검사
    if (page < 1 || limit < 1) {
      const errorResponse = NextResponse.json(
        { error: 'page와 limit은 1 이상이어야 합니다.' },
        { status: 400 }
      );
      return setCorsHeaders(request, errorResponse);
    }

    // DB에서 댓글 목록 가져오기
    const result = await getComments(page, limit);

    // 필드 매핑: 서버 필드 → 클라이언트 필드
    const mappedComments: CommentResponse[] = result.comments.map((item: CommentRow) => ({
      id: item.ID,
      parentHeaderId: item.PARENT_HEADER_ID,
      content: item.CONTENT,
      createdAt: new Date(item.CREATED_AT).toISOString(),
      updatedAt: new Date(item.UPDATED_AT).toISOString(),
      isEdited: item.IS_EDITED,
      isDeleted: item.IS_DELETED,
      version: item.VERSION,
      editedCommentId: item.EDITED_COMMENT_ID,
      headerId: item.HEADER_ID,
      tailId: item.TAIL_ID,
      hashedUser: item.HASHED_USER_IP,  // hashedUserIP → hashedUser로 매핑
      // 자식 댓글도 동일하게 매핑 (없으면 빈 배열)
      children: (item.children || []).map((child) => ({
        id: child.ID,
        parentHeaderId: child.parentHeaderId,
        content: child.CONTENT,
        createdAt: new Date(child.CREATED_AT).toISOString(),
        updatedAt: new Date(child.UPDATED_AT).toISOString(),
        isEdited: child.IS_EDITED,
        isDeleted: child.IS_DELETED,
        version: child.VERSION,
        editedCommentId: child.EDITED_COMMENT_ID,
        headerId: child.HEADER_ID,
        tailId: child.TAIL_ID,
        hashedUser: child.HASHED_USER_IP,  // hashedUserIP → hashedUser로 매핑
      })),
    }));

    const response = NextResponse.json({
      page,
      limit,
      totalCount: result.totalCount,
      data: mappedComments,
    });
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
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

/**
 * 댓글 생성 API
 * POST /api/comments
 * 새로운 댓글을 생성합니다. 부모 댓글이 있으면 대댓글이 됩니다.
 */
export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/comments', async () => {
    try {
    const body = await request.json();
    const { parentHeaderId, content, userPassword } = body;

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

    // parentHeaderId 검증 (null이거나 숫자여야 함)
    let parentId: number | null = null;
    if (parentHeaderId !== null && parentHeaderId !== undefined) {
      const parsed = parseInt(String(parentHeaderId), 10);
      if (isNaN(parsed) || parsed < 1) {
        const errorResponse = NextResponse.json(
          { error: 'parentHeaderId는 양수여야 합니다.' },
          { status: 400 }
        );
        return setCorsHeaders(request, errorResponse);
      }
      parentId = parsed;
    }

    // 클라이언트 IP 가져오기 및 해싱
    const clientIP = getClientIP(request);
    const hashedUserIP = getHashedIP(clientIP);

    // 댓글 생성
    const newId = await createComment(
      content.trim(),
      userPassword,
      hashedUserIP,
      parentId
    );

    const response = NextResponse.json(
      { id: newId },
      { status: 201 }
    );
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
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return setCorsHeaders(request, errorResponse);
    }
  });
}

