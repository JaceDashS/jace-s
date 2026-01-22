import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '../utils/requestUtils';
import { getServiceUrl, GPT_VISUALIZER_TIMEOUT } from '../utils/serviceConfig';
import { withApiLogging } from '../utils/apiLogger';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GPT Visualizer 프록시 API
 * - 외부 GPT Visualizer 서비스로의 프록시 역할
 * - 모든 HTTP 메서드 지원 (GET, POST, PUT, DELETE 등)
 * - 클라이언트 IP를 X-Forwarded-For 헤더로 전달
 * - 타임아웃 및 에러 핸들링 포함
 * 
 * @route ALL /gptvisualizer
 */
export async function GET(request: NextRequest) {
  return withApiLogging(request, '/gptvisualizer', async () => {
    return handleProxy(request, 'GET');
  });
}

export async function POST(request: NextRequest) {
  return withApiLogging(request, '/gptvisualizer', async () => {
    return handleProxy(request, 'POST');
  });
}

export async function PUT(request: NextRequest) {
  return withApiLogging(request, '/gptvisualizer', async () => {
    return handleProxy(request, 'PUT');
  });
}

export async function DELETE(request: NextRequest) {
  return withApiLogging(request, '/gptvisualizer', async () => {
    return handleProxy(request, 'DELETE');
  });
}

export async function PATCH(request: NextRequest) {
  return withApiLogging(request, '/gptvisualizer', async () => {
    return handleProxy(request, 'PATCH');
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

async function handleProxy(request: NextRequest, method: string) {
  const externalServiceUrl = getServiceUrl('gpt-3d-visualizer');
  
  if (!externalServiceUrl) {
    return NextResponse.json(
      {
        error: 'Service unavailable',
        message: 'gpt-3d-visualizer URL not configured',
      },
      { status: 503 }
    );
  }

  const clientIp = getClientIP(request);
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

    return NextResponse.json(responseData, {
      status: response.status,
      headers: headers,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAbortError = error instanceof Error && error.name === 'AbortError';

    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: errorMessage,
        path: request.nextUrl.pathname,
      },
      { status: isAbortError ? 504 : 502 }
    );
  }
}

