/**
 * DB 연결 유틸리티
 * jace-s는 독립적인 저장소이므로 DB에 직접 연결
 */
import oracledb from 'oracledb';

const { DB_USER, DB_PASSWORD, DB_CONNECTION_STRING } = process.env;

if (!DB_USER || !DB_PASSWORD || !DB_CONNECTION_STRING) {
  console.warn('⚠️ DB 환경 변수가 설정되지 않았습니다. DB 연결이 실패할 수 있습니다.');
  console.warn('필수 환경 변수: DB_USER, DB_PASSWORD, DB_CONNECTION_STRING');
}

/**
 * DB 연결 가져오기
 */
export async function getConnection() {
  if (!DB_USER || !DB_PASSWORD || !DB_CONNECTION_STRING) {
    throw new Error('DB 환경 변수가 설정되지 않았습니다. DB_USER, DB_PASSWORD, DB_CONNECTION_STRING을 확인하세요.');
  }

  try {
    const connection = await oracledb.getConnection({
      user: DB_USER,
      password: DB_PASSWORD,
      connectionString: DB_CONNECTION_STRING,
    });
    return connection;
  } catch (error) {
    console.error('[DB ERROR] DB 연결 실패:', error);
    throw error;
  }
}

