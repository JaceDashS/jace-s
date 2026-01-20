/**
 * 비밀번호 해싱 유틸리티
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// 환경 변수에서 페퍼를 불러오거나, 랜덤하게 ASCII 기반으로 생성 (HEX 형식)
const PEPPER = process.env.PEPPER 
    ? Buffer.from(process.env.PEPPER).toString('ascii') // 환경 변수 값이 아스키가 아닐 경우 변환
    : crypto.randomBytes(16).toString('hex'); // 16바이트(128비트) -> 32자 ASCII 문자열

/**
 * 비밀번호를 해싱하는 함수 (ASCII 페퍼 적용)
 * @param password - 평문 비밀번호
 * @returns 해싱된 비밀번호
 */
export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // 해싱 강도 설정
    // 평문 비밀번호에 ASCII 페퍼 추가하여 해싱
    const passwordWithPepper = Buffer.from(password + PEPPER, 'ascii').toString();
    return bcrypt.hash(passwordWithPepper, saltRounds);
}

/**
 * 입력된 비밀번호와 해싱된 비밀번호를 비교하는 함수 (ASCII 페퍼 적용)
 * @param inputPassword - 사용자가 입력한 평문 비밀번호
 * @param hashedPassword - 데이터베이스에 저장된 해싱된 비밀번호
 * @returns 비밀번호 일치 여부
 */
export async function comparePassword(inputPassword: string, hashedPassword: string): Promise<boolean> {
    // 입력된 비밀번호에도 같은 방식으로 ASCII 페퍼 추가
    const inputPasswordWithPepper = Buffer.from(inputPassword + PEPPER, 'ascii').toString();
    return bcrypt.compare(inputPasswordWithPepper, hashedPassword);
}

