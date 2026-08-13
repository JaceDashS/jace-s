import { NextRequest } from 'next/server';
import { withApiLogging } from '../../../utils/apiLogger';
import { handleOptions } from '../../../utils/corsUtils';
import { handleGptVisualizerProxy } from '../../../utils/gptVisualizerProxy';

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
    return handleGptVisualizerProxy(request, 'GET');
  });
}

export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleGptVisualizerProxy(request, 'POST');
  });
}

export async function PUT(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleGptVisualizerProxy(request, 'PUT');
  });
}

export async function DELETE(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleGptVisualizerProxy(request, 'DELETE');
  });
}

export async function PATCH(request: NextRequest) {
  return withApiLogging(request, '/api/gptvisualizer/visualize', async () => {
    return handleGptVisualizerProxy(request, 'PATCH');
  });
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
