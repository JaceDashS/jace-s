import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '../../../utils/requestUtils';
import { getServiceUrl, GPT_VISUALIZER_TIMEOUT } from '../../../utils/serviceConfig';
import { withApiLogging } from '../../../utils/apiLogger';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GPT Visualizer 프록시 API
 * - /api/gptvisualizer/visualize로 들어오면 외부 서비스의 /api/visualize로 프록시
 * - 모든 HTTP 메서드 지원 (GET, POST, PUT, DELETE 등)
 * - 클라이언트 IP를 X-Forwarded-For 헤더로 전달
 * - 타임아웃 및 에러 핸들링 포함
 * 
 * @route ALL /api/gptvisualizer/visualize
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleProxy(request, 'GET');
  });
}

export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleProxy(request, 'POST');
  });
}

export async function PUT(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleProxy(request, 'PUT');
  });
}

export async function DELETE(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleProxy(request, 'DELETE');
  });
}

export async function PATCH(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleProxy(request, 'PATCH');
  });
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  // CORS 헤더 설정
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin');
  return response;
}

async function handleProxy(request: NextRequest, method: string) {
  const externalServiceUrl = getServiceUrl('gpt-3d-visualizer');
  
  if (!externalServiceUrl) {
    const errorResponse = NextResponse.json(
      {
        error: 'Service unavailable',
        message: 'gpt-3d-visualizer URL not configured',
      },
      { status: 503 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }

  const clientIp = getClientIP(request);
  // 외부 서비스의 /api/visualize로 프록시
  const targetUrl = `${externalServiceUrl}/api/visualize`;

  try {
    // 요청 본문 읽기
    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    
    if (method !== 'GET' && method !== 'DELETE' && request.body) {
      body = await request.text();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GPT_VISUALIZER_TIMEOUT);

    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': contentType || 'application/json',
        'X-Forwarded-For': clientIp,
        'X-Original-Host': request.headers.get('host') || '',
        'X-Forwarded-Proto': request.headers.get('x-forwarded-proto') || 'http',
      },
      body: body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 응답 본문 읽기
    let responseData;
    const responseContentType = response.headers.get('content-type');
    if (responseContentType && responseContentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // 응답 헤더 복사 (문제가 될 수 있는 헤더 제외)
    const excludedHeaders = ['content-encoding', 'transfer-encoding', 'content-length', 'connection'];
    const headers = new Headers();
    
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!excludedHeaders.includes(lowerKey)) {
        headers.set(key, value);
      }
    });

    // CORS 헤더 추가
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin');

    return NextResponse.json(responseData, {
      status: response.status,
      headers: headers,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAbortError = error instanceof Error && error.name === 'AbortError';

    const errorHeaders = new Headers();
    errorHeaders.set('Access-Control-Allow-Origin', '*');
    errorHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    errorHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Origin');

    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: errorMessage,
        path: request.nextUrl.pathname,
      },
      { status: isAbortError ? 504 : 502, headers: errorHeaders }
    );
  }
}

