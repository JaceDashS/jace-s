/**
 * App 서비스
 * DB에서 앱 목록을 가져오는 로직
 */
import oracledb from 'oracledb';
import { getConnection } from '../utils/db';
import type { App } from '../types/app';

interface AppRow {
  ID: number;
  TITLE: string;
  DESCRIPTION: string | null;
  IMAGE_URL: string | null;
  APK_URL: string | null;
  INSTALLER_URL: string | null;
  PORTABLE_URL: string | null;
  WEB_URL: string | null;
  DEMO_URL: string | null;
  GITHUB_URL: string | null;
  DISPLAY_ORDER: number;
  IS_ACTIVE: number;
  CREATED_AT: Date;
  UPDATED_AT: Date;
}

/**
 * 활성화된 앱 조회 (페이지네이션)
 * - IS_ACTIVE = 1인 앱만 반환
 * - DISPLAY_ORDER, ID 순으로 정렬
 * @param page 페이지 번호 (1부터 시작)
 * @param limit 페이지당 앱 개수
 * @returns 앱 목록과 총 개수
 */
export async function getAllApps(page: number, limit: number): Promise<{ apps: App[]; totalCount: number }> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await getConnection();

    // 1. 총 앱 개수 조회
    const countQuery = `
      SELECT COUNT(*) AS TOTAL
      FROM APPS
      WHERE IS_ACTIVE = 1
    `;

    const countResult = await connection.execute<{ TOTAL: number }>(
      countQuery,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const totalCount = countResult.rows?.[0]?.TOTAL ?? 0;

    // 2. 페이지네이션된 앱 목록 조회
    const offset = (page - 1) * limit;
    const query = `
      SELECT 
        ID,
        TITLE,
        DESCRIPTION,
        IMAGE_URL,
        APK_URL,
        INSTALLER_URL,
        PORTABLE_URL,
        WEB_URL,
        DEMO_URL,
        GITHUB_URL,
        DISPLAY_ORDER,
        IS_ACTIVE,
        CREATED_AT,
        UPDATED_AT
      FROM APPS
      WHERE IS_ACTIVE = 1
      ORDER BY DISPLAY_ORDER DESC, ID DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;

    const result = await connection.execute<AppRow>(
      query,
      { offset, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Oracle 결과를 App 인터페이스 형식으로 변환
    const apps: App[] = (result.rows ?? []).map((row) => ({
      id: row.ID,
      title: row.TITLE,
      description: row.DESCRIPTION,
      imageUrl: row.IMAGE_URL,
      apkUrl: row.APK_URL,
      installerUrl: row.INSTALLER_URL,
      portableUrl: row.PORTABLE_URL,
      webUrl: row.WEB_URL,
      demoUrl: row.DEMO_URL,
      githubUrl: row.GITHUB_URL,
      displayOrder: row.DISPLAY_ORDER,
      isActive: row.IS_ACTIVE,
      createdAt: new Date(row.CREATED_AT),
      updatedAt: new Date(row.UPDATED_AT),
    }));

    return { apps, totalCount };
  } catch (error) {
    console.error('[APP SERVICE ERROR] getAllApps 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('[DB ERROR] DB 연결 종료 실패:', err);
      }
    }
  }
}

