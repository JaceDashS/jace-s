/**
 * 해싱 유틸리티
 */
import crypto from 'crypto';

/**
 * IP를 해싱하여 hashedUserIP를 생성
 * @param ip - 클라이언트 IP 주소
 * @returns 해싱된 IP (SHA-256, 처음 8자리)
 */
export function getHashedIP(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8);
}

