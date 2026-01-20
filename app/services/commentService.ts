/**
 * Comment 서비스
 * 댓글 관련 비즈니스 로직
 */
import oracledb from 'oracledb';
import { getConnection } from '../utils/db';
import { handleLob } from '../utils/handleLob';
import { hashPassword, comparePassword } from '../utils/passwordUtils';
import type { Comment } from '../types/comment';

interface ParentCommentRowRaw {
  ID: number;
  HASHED_USER_IP: string;
  CONTENT: string | oracledb.Lob | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  IS_EDITED: number;
  IS_DELETED: number;
  VERSION: number;
  HEADER_ID: number;
  TAIL_ID: number;
  PARENT_HEADER_ID: number | null;
  EDITED_COMMENT_ID: number | null;
}

interface ChildCommentRowRaw {
  ID: number;
  parentHeaderId: number | null;
  CONTENT: string | oracledb.Lob | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  IS_EDITED: number;
  IS_DELETED: number;
  VERSION: number;
  EDITED_COMMENT_ID: number | null;
  HEADER_ID: number;
  TAIL_ID: number;
  HASHED_USER_IP: string;
}

interface ParentCommentRow extends Omit<ParentCommentRowRaw, 'CONTENT'> {
  CONTENT: string | null;
}

interface ChildCommentRow extends Omit<ChildCommentRowRaw, 'CONTENT'> {
  CONTENT: string | null;
}

type ParentCommentWithChildren = ParentCommentRow & { children: ChildCommentRow[] };

interface CommentHistoryRow {
  id: number;
  parentHeaderId: number | null;
  content: string | oracledb.Lob | null;
  createdAt: Date;
  updatedAt: Date;
  isEdited: number;
  isDeleted: number;
  version: number;
  editedCommentId: number | null;
  headerId: number;
  tailId: number;
  hashedUserIP: string;
  hashedPassword: string;
}

/**
 * 부모 댓글과 해당 자식 댓글을 함께 조회 (페이지네이션)
 * @param page 페이지 번호 (1부터 시작)
 * @param limit 페이지당 댓글 개수
 * @returns 댓글 목록과 총 개수
 */
export async function getComments(
  page: number,
  limit: number
): Promise<{ comments: ParentCommentWithChildren[]; totalCount: number }> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 1. 부모 댓글 총 개수 조회
    const countSql = `
      SELECT COUNT(*) AS TOTAL
      FROM COMMENTS
      WHERE PARENT_HEADER_ID IS NULL
        AND ID = TAIL_ID
    `;
    const countResult = await connection.execute<{ TOTAL: number }>(
      countSql,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const totalCount = countResult.rows?.[0]?.TOTAL ?? 0;

    // 2. 부모 댓글 데이터 조회 (페이지네이션 적용)
    //    - c: 현재(최신 버전) 댓글, p: 헤더(원본) 댓글
    const offset = (page - 1) * limit;
    const parentSql = `
      SELECT 
        c.ID, 
        c.HASHED_USER_IP, 
        c.CONTENT, 
        c.CREATED_AT, 
        c.UPDATED_AT, 
        c.IS_EDITED, 
        c.IS_DELETED, 
        c.VERSION, 
        c.HEADER_ID, 
        c.TAIL_ID,
        c.PARENT_HEADER_ID,
        c.EDITED_COMMENT_ID
      FROM COMMENTS c
      JOIN COMMENTS p ON c.HEADER_ID = p.ID
      WHERE c.PARENT_HEADER_ID IS NULL
        AND c.ID = c.TAIL_ID
      ORDER BY p.CREATED_AT DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;
    const parentResult = await connection.execute<ParentCommentRowRaw>(
      parentSql,
      { offset, limit },
      { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const parentRS = parentResult.resultSet as oracledb.ResultSet<ParentCommentRowRaw>;
    const parentRows: ParentCommentRow[] = [];
    let row: ParentCommentRowRaw | undefined;
    while ((row = await parentRS.getRow())) {
      const content = row.CONTENT ? await handleLob(row.CONTENT) : null;
      parentRows.push({
        ...row,
        CONTENT: content,
      });
    }
    await parentRS.close();

    // 3. 조회된 부모 댓글들의 HEADER_ID 목록 추출
    const headerIds = parentRows
      .map(item => item.HEADER_ID)
      .filter((id): id is number => id !== null && id !== undefined);
    let childrenRows: ChildCommentRow[] = [];
    if (headerIds.length > 0) {
      // 4. 자식(대댓글) 조회: 부모 댓글의 HEADER_ID를 PARENT_HEADER_ID로 갖는 댓글 조회
      //    - c: 자식 댓글, p: 헤더 댓글
      //    정렬은 p.CREATED_AT 기준 오름차순(원래 입력 순서 유지)
      const bindNames = headerIds.map((_, idx) => `:id${idx}`).join(', ');
      const childrenSql = `
        SELECT 
          c.ID, 
          c.PARENT_HEADER_ID AS "parentHeaderId", 
          c.CONTENT, 
          c.CREATED_AT, 
          c.UPDATED_AT, 
          c.IS_EDITED, 
          c.IS_DELETED, 
          c.VERSION, 
          c.EDITED_COMMENT_ID, 
          c.HEADER_ID, 
          c.TAIL_ID, 
          c.HASHED_USER_IP
        FROM COMMENTS c
        JOIN COMMENTS p ON c.HEADER_ID = p.ID
        WHERE c.PARENT_HEADER_ID IN (${bindNames})
          AND c.ID = c.TAIL_ID
        ORDER BY p.CREATED_AT ASC
      `;
      const bindParams: { [key: string]: number } = {};
      headerIds.forEach((id, idx) => {
        bindParams[`id${idx}`] = id;
      });
      const childrenResult = await connection.execute<ChildCommentRowRaw>(
        childrenSql,
        bindParams,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const rawChildrenRows = childrenResult.rows ?? [];
      childrenRows = await Promise.all(
        rawChildrenRows.map(async (child) => ({
          ...child,
          CONTENT: child.CONTENT ? await handleLob(child.CONTENT) : null,
        }))
      );

    }

    // 5. 부모 댓글별로 자식 댓글 그룹핑
    const childrenByParent: Record<number, ChildCommentRow[]> = {};
    for (const child of childrenRows) {
      if (child.parentHeaderId === null) {
        continue;
      }
      const key = child.parentHeaderId;
      if (!childrenByParent[key]) {
        childrenByParent[key] = [];
      }
      childrenByParent[key].push(child);
    }

    // 6. 각 부모 댓글 객체에 자식 댓글 배열 추가
    const combinedComments = parentRows.map(parent => ({
      ...parent,
      children: childrenByParent[parent.HEADER_ID] || [],
    }));

    return { comments: combinedComments, totalCount };
  } catch (error) {
    console.error('[COMMENT SERVICE ERROR] 부모+자식 댓글 조회 중 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('[DB ERROR] DB 연결 종료 중 오류:', closeError);
      }
    }
  }
}

/**
 * 새로운 댓글 생성
 * @param content 댓글 내용
 * @param userPassword 사용자 비밀번호
 * @param hashedUserIP 해싱된 사용자 IP
 * @param parentHeaderId 부모 댓글의 HEADER_ID (대댓글인 경우), null이면 루트 댓글
 * @returns 생성된 댓글의 ID
 */
export async function createComment(
  content: string,
  userPassword: string,
  hashedUserIP: string,
  parentHeaderId: number | null
): Promise<number> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(userPassword);

    // INSERT 쿼리 실행 (ID는 IDENTITY로 자동 생성, RETURNING으로 가져옴)
    // HEADER_ID와 TAIL_ID는 먼저 NULL로 설정 후 UPDATE
    const insertSql = `
      INSERT INTO COMMENTS (
        HASHED_USER_IP,
        HASHED_PASSWORD,
        PARENT_HEADER_ID,
        CONTENT,
        CREATED_AT,
        UPDATED_AT,
        IS_EDITED,
        IS_DELETED,
        VERSION,
        EDITED_COMMENT_ID,
        HEADER_ID,
        TAIL_ID
      ) VALUES (
        :hashedUserIP,
        :hashedPassword,
        :parentHeaderId,
        :content,
        SYSTIMESTAMP,
        SYSTIMESTAMP,
        0,
        0,
        1,
        NULL,
        NULL,
        NULL
      )
      RETURNING ID INTO :insertedId
    `;

    const insertResult = await connection.execute<{ insertedId: number[] }>(
      insertSql,
      {
        hashedUserIP,
        hashedPassword,
        parentHeaderId: parentHeaderId || null,
        content,
        insertedId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { 
        autoCommit: false
      }
    );
    
    if (!insertResult.outBinds || !insertResult.outBinds.insertedId) {
      throw new Error('댓글 생성 실패: insertedId가 없습니다.');
    }

    const newId = insertResult.outBinds.insertedId[0];

    // HEADER_ID와 TAIL_ID를 자신의 ID로 업데이트
    const updateSql = `
      UPDATE COMMENTS
      SET HEADER_ID = :newId,
          TAIL_ID = :newId
      WHERE ID = :newId
    `;
    
    await connection.execute(
      updateSql,
      { newId },
      { autoCommit: false }
    );

    // 트랜잭션 커밋
    await connection.commit();
    
    return newId;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[DB ERROR] 롤백 중 오류:', rollbackError);
      }
    }
    console.error('[COMMENT SERVICE ERROR] 댓글 생성 중 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('[DB ERROR] DB 연결 종료 중 오류:', closeError);
      }
    }
  }
}

/**
 * 댓글 수정 (비밀번호 검증 및 불변성 유지)
 * @param originalId 수정할 댓글 ID
 * @param newContent 새로운 댓글 내용
 * @param userPassword 사용자 비밀번호
 * @param hashedUserIP 해싱된 사용자 IP
 * @returns 새로 생성된 댓글의 ID
 */
export async function updateComment(
  originalId: number,
  newContent: string,
  userPassword: string,
  hashedUserIP: string
): Promise<number> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 1) 기존 댓글 조회
    const selectSql = `
      SELECT 
        ID, 
        PARENT_HEADER_ID AS "parentHeaderId", 
        HASHED_USER_IP AS "hashedUserIP",
        HASHED_PASSWORD AS "hashedPassword", 
        HEADER_ID AS "headerId", 
        VERSION AS "version",
        IS_EDITED AS "isEdited", 
        EDITED_COMMENT_ID AS "editedCommentId", 
        UPDATED_AT AS "updatedAt", 
        IS_DELETED AS "isDeleted",
        TAIL_ID AS "tailId"
      FROM COMMENTS 
      WHERE ID = :originalId
    `;
    const selectResult = await connection.execute<Partial<Comment>>(
      selectSql,
      { originalId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const oldComments = selectResult.rows;

    if (!oldComments || oldComments.length === 0) {
      throw new Error('존재하지 않는 댓글입니다.');
    }

    const oldComment = oldComments[0];

    if (!oldComment.hashedPassword) {
      throw new Error('해시된 비밀번호가 존재하지 않습니다.');
    }

    // 삭제된 댓글이면 수정 불가
    if (oldComment.isDeleted !== 0) {
      throw new Error('이미 삭제된 댓글은 수정할 수 없습니다.');
    }

    // 기존 댓글이 이미 수정된 경우 (editedCommentId가 존재하면 수정 불가)
    if (oldComment.editedCommentId !== null) {
      throw new Error('이미 수정된 댓글은 다시 수정할 수 없습니다.');
    }

    // 비밀번호 검증
    const isPasswordMatch = await comparePassword(userPassword, oldComment.hashedPassword);

    if (!isPasswordMatch) {
      throw new Error('비밀번호가 일치하지 않아 수정할 수 없습니다.');
    }

    // 2) 기존 댓글의 IS_EDITED = 1로 표시
    const markEditedSql = `UPDATE COMMENTS SET IS_EDITED = 1 WHERE ID = :originalId`;
    await connection.execute(markEditedSql, { originalId }, { autoCommit: false });

    // 3) 새 댓글 삽입 (버전 + 1)
    const newVersion = (oldComment.version || 1) + 1;
    const insertSql = `
      INSERT INTO COMMENTS (
        PARENT_HEADER_ID, 
        CONTENT, 
        CREATED_AT, 
        UPDATED_AT,
        IS_EDITED, 
        IS_DELETED, 
        VERSION, 
        EDITED_COMMENT_ID,
        HEADER_ID, 
        TAIL_ID,
        HASHED_USER_IP, 
        HASHED_PASSWORD
      )
      VALUES (
        :parentHeaderId, 
        :content, 
        SYSTIMESTAMP, 
        SYSTIMESTAMP,
        0, 
        0, 
        :version, 
        NULL,
        :headerId, 
        NULL,
        :newHashedUserIP, 
        :hashedPassword
      )
      RETURNING ID INTO :newId
    `;
    const insertResult = await connection.execute<{ newId: number[] }>(
      insertSql,
      {
        parentHeaderId: oldComment.parentHeaderId || null,
        content: newContent,
        version: newVersion,
        headerId: oldComment.headerId,
        newHashedUserIP: hashedUserIP,
        hashedPassword: oldComment.hashedPassword,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false }
    );

    if (!insertResult.outBinds || !insertResult.outBinds.newId) {
      throw new Error('댓글 수정 실패: newId가 없습니다.');
    }
    const newId = insertResult.outBinds.newId[0];

    // 4) 새 댓글의 TAIL_ID를 자기 자신으로 업데이트
    const updateNewTailSql = `UPDATE COMMENTS SET TAIL_ID = :newId WHERE ID = :newId`;
    await connection.execute(updateNewTailSql, { newId }, { autoCommit: false });

    // 5) 기존 댓글의 EDITED_COMMENT_ID, TAIL_ID를 새 댓글로 연결
    const updateOldCommentSql = `
      UPDATE COMMENTS
      SET EDITED_COMMENT_ID = :newId,
          TAIL_ID = :newId,
          UPDATED_AT = SYSTIMESTAMP
      WHERE ID = :originalId
    `;
    await connection.execute(updateOldCommentSql, { newId, originalId }, { autoCommit: false });

    // 6) 동일 HEADER_ID를 공유하는 모든 댓글의 TAIL_ID를 새 댓글 ID로 갱신
    const updateAllTailSql = `
      UPDATE COMMENTS
      SET TAIL_ID = :newId,
          UPDATED_AT = SYSTIMESTAMP
      WHERE HEADER_ID = :headerId
    `;
    await connection.execute(updateAllTailSql, { newId, headerId: oldComment.headerId }, { autoCommit: false });

    // 트랜잭션 커밋
    await connection.commit();

    return newId;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[DB ERROR] 롤백 중 오류:', rollbackError);
      }
    }
    console.error('[COMMENT SERVICE ERROR] 댓글 수정 중 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('[DB ERROR] DB 연결 종료 중 오류:', closeError);
      }
    }
  }
}

/**
 * 댓글 삭제 (비밀번호 검증 및 불변성 유지)
 * @param commentId 삭제할 댓글 ID
 * @param userPassword 사용자 비밀번호
 * @param hashedUserIP 해싱된 사용자 IP
 * @returns 삭제된 댓글의 ID
 */
export async function deleteComment(
  commentId: number,
  userPassword: string,
  hashedUserIP: string
): Promise<number> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 1) 기존 댓글 조회
    const selectSql = `
      SELECT 
        ID, 
        PARENT_HEADER_ID AS "parentHeaderId", 
        HASHED_USER_IP AS "hashedUserIP",
        HASHED_PASSWORD AS "hashedPassword", 
        HEADER_ID AS "headerId", 
        VERSION AS "version",
        IS_EDITED AS "isEdited", 
        EDITED_COMMENT_ID AS "editedCommentId", 
        UPDATED_AT AS "updatedAt", 
        IS_DELETED AS "isDeleted",
        TAIL_ID AS "tailId"
      FROM COMMENTS 
      WHERE ID = :commentId
    `;
    const selectResult = await connection.execute<Partial<Comment>>(
      selectSql,
      { commentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const oldComments = selectResult.rows;

    if (!oldComments || oldComments.length === 0) {
      throw new Error('존재하지 않는 댓글입니다.');
    }

    const oldComment = oldComments[0];

    if (!oldComment.hashedPassword) {
      throw new Error('해시된 비밀번호가 존재하지 않습니다.');
    }

    // 삭제된 댓글이면 삭제 불가
    if (oldComment.isDeleted !== 0) {
      throw new Error('이미 삭제된 댓글은 삭제할 수 없습니다.');
    }

    // 기존 댓글이 이미 수정된 경우 (editedCommentId가 존재하면 삭제 불가)
    if (oldComment.editedCommentId !== null) {
      throw new Error('이미 수정된 댓글은 삭제할 수 없습니다.');
    }

    // 비밀번호 검증
    const isPasswordMatch = await comparePassword(userPassword, oldComment.hashedPassword);

    if (!isPasswordMatch) {
      throw new Error('비밀번호가 일치하지 않아 삭제할 수 없습니다.');
    }

    // 2) 기존 댓글의 IS_EDITED = 1로 표시
    const markEditedSql = `UPDATE COMMENTS SET IS_EDITED = 1 WHERE ID = :commentId`;
    await connection.execute(markEditedSql, { commentId }, { autoCommit: false });

    // 3) 새 댓글(삭제 상태) 삽입 (버전 + 1)
    const newVersion = (oldComment.version || 1) + 1;
    const insertSql = `
      INSERT INTO COMMENTS (
        PARENT_HEADER_ID, CONTENT, CREATED_AT, UPDATED_AT,
        IS_EDITED, IS_DELETED, VERSION, EDITED_COMMENT_ID,
        HEADER_ID, TAIL_ID,
        HASHED_USER_IP, HASHED_PASSWORD
      )
      VALUES (
        :parentHeaderId, NULL, SYSTIMESTAMP, SYSTIMESTAMP,
        0, 1, :version, NULL,
        :headerId, NULL,
        :newHashedUserIP, :hashedPassword
      )
      RETURNING ID INTO :newId
    `;
    const insertResult = await connection.execute<{ newId: number[] }>(
      insertSql,
      {
        parentHeaderId: oldComment.parentHeaderId || null,
        version: newVersion,
        headerId: oldComment.headerId,
        newHashedUserIP: hashedUserIP,
        hashedPassword: oldComment.hashedPassword,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false }
    );

    if (!insertResult.outBinds || !insertResult.outBinds.newId) {
      throw new Error('댓글 삭제 실패: newId가 없습니다.');
    }
    const newId = insertResult.outBinds.newId[0];

    // 4) 새 댓글의 TAIL_ID를 자기 자신으로 업데이트
    const updateNewTailSql = `UPDATE COMMENTS SET TAIL_ID = :newId WHERE ID = :newId`;
    await connection.execute(updateNewTailSql, { newId }, { autoCommit: false });

    // 5) 기존 댓글의 TAIL_ID를 새 댓글 ID로 업데이트
    const updateOldTailSql = `UPDATE COMMENTS SET TAIL_ID = :newId WHERE HEADER_ID = :headerId`;
    await connection.execute(updateOldTailSql, { newId, headerId: oldComment.headerId }, { autoCommit: false });

    // 트랜잭션 커밋
    await connection.commit();

    return newId;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[DB ERROR] 롤백 중 오류:', rollbackError);
      }
    }
    console.error('[COMMENT SERVICE ERROR] 댓글 삭제 중 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('[DB ERROR] DB 연결 종료 중 오류:', closeError);
      }
    }
  }
}

/**
 * 특정 댓글의 모든 히스토리 조회 (삭제되지 않은 댓글만)
 * - 같은 HEADER_ID를 공유하는 댓글을 모두 조회
 * - 삭제되지 않은 댓글만 포함
 * @param commentId 댓글 ID (HEADER_ID 또는 체인 내의 임의 ID)
 * @returns 댓글 히스토리 배열
 */
export async function getCommentHistory(commentId: number): Promise<Comment[]> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 1) 주어진 commentId의 HEADER_ID 조회
    const headerSql = `
      SELECT HEADER_ID 
      FROM COMMENTS 
      WHERE ID = :commentId
    `;
    const headerResult = await connection.execute<{ HEADER_ID: number }>(
      headerSql,
      { commentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!headerResult.rows || headerResult.rows.length === 0) {
      throw new Error('해당 댓글을 찾을 수 없습니다.');
    }

    const headerId = headerResult.rows[0].HEADER_ID;

    // 2) 같은 HEADER_ID를 가진 모든 댓글 조회 (삭제되지 않은 댓글만)
    const historySql = `
      SELECT 
        ID AS "id",
        PARENT_HEADER_ID AS "parentHeaderId",
        CONTENT AS "content",
        CREATED_AT AS "createdAt",
        UPDATED_AT AS "updatedAt",
        IS_EDITED AS "isEdited",
        IS_DELETED AS "isDeleted",
        VERSION AS "version",
        EDITED_COMMENT_ID AS "editedCommentId",
        HEADER_ID AS "headerId",
        TAIL_ID AS "tailId",
        HASHED_USER_IP AS "hashedUserIP",
        HASHED_PASSWORD AS "hashedPassword"
      FROM COMMENTS
      WHERE HEADER_ID = :headerId
        AND IS_DELETED = 0
      ORDER BY VERSION ASC
    `;
    const historyResult = await connection.execute<CommentHistoryRow>(
      historySql,
      { headerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // CLOB 변환 처리
    const historyComments: Comment[] = await Promise.all(
      (historyResult.rows ?? []).map(async (row) => ({
        id: row.id,
        parentHeaderId: row.parentHeaderId,
        content: row.content ? await handleLob(row.content) : row.content,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isEdited: row.isEdited,
        isDeleted: row.isDeleted,
        version: row.version,
        editedCommentId: row.editedCommentId,
        headerId: row.headerId,
        tailId: row.tailId,
        hashedUserIP: row.hashedUserIP,
        hashedPassword: row.hashedPassword,
      }))
    );

    return historyComments;
  } catch (error) {
    console.error('[COMMENT SERVICE ERROR] 댓글 히스토리 조회 중 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('[DB ERROR] DB 연결 종료 중 오류:', closeError);
      }
    }
  }
}
