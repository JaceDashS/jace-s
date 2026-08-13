import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from './requestUtils';
import { getServiceUrl, GPT_VISUALIZER_TIMEOUT } from './serviceConfig';
import { setCorsHeaders } from './corsUtils';

export type GptVisualizerMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

const excludedResponseHeaders = new Set([
  'content-encoding',
  'transfer-encoding',
  'content-length',
  'connection',
]);

export async function handleGptVisualizerProxy(
  request: NextRequest,
  method: GptVisualizerMethod
): Promise<NextResponse> {
  const externalServiceUrl = getServiceUrl('gpt-3d-visualizer');

  if (!externalServiceUrl) {
    return setCorsHeaders(
      request,
      NextResponse.json(
        {
          error: 'Service unavailable',
          message: 'gpt-3d-visualizer URL not configured',
        },
        { status: 503 }
      )
    );
  }

  const clientIp = getClientIP(request);
  const targetUrl = `${externalServiceUrl}/api/visualize`;
  const contentType = request.headers.get('content-type');
  const body = method !== 'GET' && method !== 'DELETE' && request.body
    ? await request.text()
    : undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), GPT_VISUALIZER_TIMEOUT);

    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': contentType || 'application/json',
        'X-Forwarded-For': clientIp,
        'X-Original-Host': request.headers.get('host') || '',
        'X-Forwarded-Proto': request.headers.get('x-forwarded-proto') || 'http',
      },
      body,
      signal: controller.signal,
    });

    const responseContentType = response.headers.get('content-type');
    const responseData = responseContentType?.includes('application/json')
      ? await response.json()
      : await response.text();
    const headers = new Headers();

    response.headers.forEach((value, key) => {
      if (!excludedResponseHeaders.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    return setCorsHeaders(
      request,
      NextResponse.json(responseData, {
        status: response.status,
        headers,
      })
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAbortError = error instanceof Error && error.name === 'AbortError';

    return setCorsHeaders(
      request,
      NextResponse.json(
        {
          error: 'Bad Gateway',
          message: errorMessage,
          path: request.nextUrl.pathname,
        },
        { status: isAbortError ? 504 : 502 }
      )
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
