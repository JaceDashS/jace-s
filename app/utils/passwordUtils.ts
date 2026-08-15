/**
 * 비밀번호 해싱 유틸리티
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

function getPepper(): string {
    const pepper = process.env.PEPPER;
    if (!pepper) {
        throw new Error('PEPPER is not configured');
    }
    return pepper;
}

function addPepper(password: string): string {
    return password + getPepper();
}

/**
 * 비밀번호를 해싱하는 함수 (ASCII 페퍼 적용)
 * @param password - 평문 비밀번호
 * @returns 해싱된 비밀번호
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(addPepper(password), SALT_ROUNDS);
}

/**
 * 입력된 비밀번호와 해싱된 비밀번호를 비교하는 함수 (ASCII 페퍼 적용)
 * @param inputPassword - 사용자가 입력한 평문 비밀번호
 * @param hashedPassword - 데이터베이스에 저장된 해싱된 비밀번호
 * @returns 비밀번호 일치 여부
 */
export async function comparePassword(inputPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(addPepper(inputPassword), hashedPassword);
}
