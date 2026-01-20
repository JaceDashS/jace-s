/**
 * Oracle LOB 처리 유틸리티
 * CLOB 타입을 문자열로 변환
 */
import oracledb from 'oracledb';

/**
 * LOB를 문자열로 변환하는 함수
 * @param lob LOB 객체 또는 일반 데이터
 * @returns 변환된 문자열
 */
function isLob(value: unknown): value is oracledb.Lob {
  return (
    typeof value === 'object' &&
    value !== null &&
    'on' in value &&
    'setEncoding' in value
  );
}

export async function handleLob(lob: unknown): Promise<string> {
  if (lob === null || lob === undefined) {
    return '';
  }

  // LOB 객체인지 확인 (메서드 존재 여부로 판단)
  if (isLob(lob)) {
    return new Promise((resolve, reject) => {
      let data = '';
      lob.setEncoding('utf8');
      lob.on('data', (chunk: string) => {
        data += chunk;
      });
      lob.on('end', () => {
        resolve(data);
      });
      lob.on('error', (err: Error) => {
        reject(err);
      });
    });
  } else {
    // LOB가 아닌 경우 문자열로 변환
    return String(lob);
  }
}

