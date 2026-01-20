/**
 * Comment 타입 정의
 */
export interface Comment {
  id: number;                 // 고유 아이디
  hashedUserIP: string;       // IP 기반 해싱된 유저명
  hashedPassword: string;     // 해싱된 비밀번호 (서버 전용, 클라이언트에 노출 안 됨)
  parentHeaderId: number | null;  // 부모댓글의 HEADER_ID (없으면 루트 댓글)
  content: string | null;     // 댓글 내용 (삭제 시 null)
  createdAt: Date;
  updatedAt: Date;
  isEdited: number;           // 0: 수정 안 됨, 1: 수정됨
  isDeleted: number;          // 0: 삭제 안 됨, 1: 삭제됨
  version: number;            // 버전 (1부터 시작)
  editedCommentId: number | null;  // 이전 버전 댓글 ID
  headerId: number;           // 체인의 헤더 ID
  tailId: number;             // 체인의 테일 ID
}

/**
 * 클라이언트 응답용 Comment 타입
 * hashedUserIP를 hashedUser로, hashedPassword는 제외
 */
export interface CommentResponse {
  id: number;
  parentHeaderId: number | null;
  content: string | null;
  createdAt: string;  // ISO 8601 문자열
  updatedAt: string;  // ISO 8601 문자열
  isEdited: number;
  isDeleted: number;
  version: number;
  editedCommentId: number | null;
  headerId: number;
  tailId: number;
  hashedUser: string;  // hashedUserIP를 hashedUser로 매핑
  children?: CommentResponse[];  // GET /api/comments 응답에만 포함
}

