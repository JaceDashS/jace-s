/**
 * 요청 유틸리티 (Next.js Request)
 */
import { NextRequest } from 'next/server';

/**
 * 클라이언트의 실제 IP를 가져오는 함수
 * - `X-Forwarded-For` 헤더가 있는 경우 첫 번째 IP를 반환
 * - 없으면 `req.ip` 또는 headers에서 추출
 * - IPv6 맵핑된 IPv4 주소(::ffff:127.0.0.1)를 IPv4로 변환
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  let ip: string;

  if (forwarded) {
    ip = forwarded.split(',')[0].trim(); // 첫 번째 IP 추출
  } else {
    // NextRequest에서 IP 추출 시도 (x-real-ip 헤더 사용)
    const realIp = request.headers.get('x-real-ip');
    ip = realIp || '0.0.0.0';
  }

  // IPv6 맵핑된 IPv4 주소를 IPv4로 변환 (::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // IPv6 localhost를 IPv4 localhost로 변환
  if (ip === '::1') {
    ip = '127.0.0.1';
  }

  return ip;
}

