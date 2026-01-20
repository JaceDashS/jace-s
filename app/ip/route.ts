import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '../utils/requestUtils';
import { withApiLogging } from '../utils/apiLogger';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * IP 정보 조회 API
 * - 클라이언트 IP 주소 반환
 * - 서버의 공인 IP 주소 조회 (ipify API 사용)
 * 
 * @route GET /ip
 * @returns { message: string, clientIp: string, serverPublicIp: string }
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/ip', async () => {
    try {
      // 클라이언트 IP 확인
      const clientIp = getClientIP(request);
      
      // ipify API를 통해 서버의 공인 IP 조회
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`ipify API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as { ip: string };
      const serverIp = data.ip;
      
      return NextResponse.json({
        message: 'OK',
        clientIp,
        serverPublicIp: serverIp,
      });
    } catch (error) {
      console.error('서버의 공인 IP 조회 실패:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : '서버의 공인 IP 조회 실패';
      
      return NextResponse.json(
        { message: errorMessage },
        { status: 500 }
      );
    }
  });
}

