import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

const HOST_TOKEN_BYTES = 32;
const HOST_TOKEN_HASH_HEX_LENGTH = HOST_TOKEN_BYTES * 2;

export interface HostTokenPair {
  token: string;
  tokenHash: string;
}

/** 호스트 토큰 원문과 저장용 해시를 생성합니다. */
export function createHostToken(): HostTokenPair {
  const token = randomBytes(HOST_TOKEN_BYTES).toString('base64url');
  return {
    token,
    tokenHash: hashHostToken(token)
  };
}

/** 호스트 토큰은 원문 대신 SHA-256 해시로 저장합니다. */
export function hashHostToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Authorization 헤더에서 Bearer 토큰만 추출합니다. */
export function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || null;
}

/** 저장된 해시와 일정 시간 비교하여 호스트 토큰을 검증합니다. */
export function verifyHostToken(token: string, expectedHash: string): boolean {
  if (!token || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashHostToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length || expected.length !== HOST_TOKEN_HASH_HEX_LENGTH / 2) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
