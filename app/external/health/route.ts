import { NextRequest, NextResponse } from 'next/server';
import { getServiceConfigs, EXTERNAL_HEALTH_TIMEOUT } from '../../utils/serviceConfig';
import { withApiLogging } from '../../utils/apiLogger';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 모든 외부 서비스 헬스체크 API
 * - 환경변수에서 EXTERNAL_SERVICE_*_URL 패턴을 찾아 모든 서비스의 헬스체크를 수행
 * - 각 서비스의 /health 엔드포인트를 호출하여 상태 확인
 * 
 * @route GET /external/health
 * @returns { gateway: string, services: Array, timestamp: string }
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/external/health', async () => {
    // 환경변수에서 서비스 설정 가져오기
    const services = getServiceConfigs();

  // 모든 서비스의 헬스체크를 병렬로 수행
  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      const healthUrl = `${service.url}/health`;
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_HEALTH_TIMEOUT);

        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        // 응답 데이터 읽기
        let responseData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        return {
          name: service.name,
          url: service.url,
          status: response.ok ? 'healthy' : 'unhealthy',
          response: responseData,
          responseTime: duration,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = error instanceof Error && (
          error.name === 'AbortError' || 
          errorMessage.includes('timeout')
        );

        return {
          name: service.name,
          url: service.url,
          status: 'unhealthy',
          error: errorMessage,
          responseTime: duration,
          isTimeout,
        };
      }
    })
  );

  // Promise.allSettled 결과를 정리
  const results = healthChecks.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name: services[index].name,
        url: services[index].url,
        status: 'error',
        error: result.reason instanceof Error 
          ? result.reason.message 
          : 'Unknown error',
      };
    }
  });

  // 모든 서비스가 healthy인지 확인
  const allHealthy = results.every((r) => r.status === 'healthy');
  const statusCode = allHealthy ? 200 : 503;

    return NextResponse.json(
      {
        gateway: 'healthy',
        services: results,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  });
}

