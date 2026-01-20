import { NextRequest, NextResponse } from 'next/server';
import { getServiceUrl, EXTERNAL_HEALTH_TIMEOUT } from '../../../utils/serviceConfig';
import { withApiLogging } from '../../../utils/apiLogger';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 특정 외부 서비스 헬스체크 API
 * - 지정된 서비스의 /health 엔드포인트를 호출하여 상태 확인
 * 
 * @route GET /external/health/:service
 * @param service 서비스 이름 (예: 'gpt-visualizer')
 * @returns { service: string, status: string, url: string, response?: any, error?: string }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ service: string }> }
) {
  const params = await context.params;
  const { service } = params;
  return withApiLogging(request, `/external/health/${service}`, async () => {
    const serviceUrl = getServiceUrl(service);
    if (!serviceUrl) {
      return NextResponse.json(
        {
          error: 'Service not found',
          service,
        },
        { status: 404 }
      );
    }

  try {
    const healthUrl = `${serviceUrl}/health`;
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

    // 응답 데이터 읽기
    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

      return NextResponse.json({
        service,
        status: response.ok ? 'healthy' : 'unhealthy',
        url: serviceUrl,
        response: responseData,
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof Error && (
      error.name === 'AbortError' || 
      errorMessage.includes('timeout')
    );
    const statusCode = isTimeout ? 503 : 503;

      return NextResponse.json(
        {
          service,
          status: 'unhealthy',
          url: serviceUrl,
          error: errorMessage,
        },
        { status: statusCode }
      );
  }
  });
}

