import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from './requestUtils';
import { logDebug, logError, logInfo } from './logging';
import { getVisitorAddressLog, type VisitorAddressLog } from './visitorRegionLogger';

export type ServiceName = 'Jace-S' | 'Online Sequencer' | 'GPT 3D Visualizer' | 'Unknown';

function getPathServiceName(path: string): ServiceName | null {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.includes('/online-sequencer')) {
    return 'Online Sequencer';
  }
  if (normalizedPath.includes('/gptvisualizer') || normalizedPath.includes('/gpt-visualizer')) {
    return 'GPT 3D Visualizer';
  }

  return null;
}

function getOriginServiceName(source: string): ServiceName | null {
  try {
    const hostname = new URL(source).hostname.toLowerCase();

    if (hostname.includes('gpt') && hostname.includes('visualizer')) {
      return 'GPT 3D Visualizer';
    }
    if (hostname.includes('online') && hostname.includes('sequencer')) {
      return 'Online Sequencer';
    }
    if (hostname.includes('sequencer')) {
      return 'Online Sequencer';
    }
    if (hostname === 'jace-s.com' || hostname.endsWith('.jace-s.com')) {
      return 'Jace-S';
    }
  } catch {
    return null;
  }

  return null;
}

export function getServiceName(
  origin: string,
  xOrigin: string | null,
  path: string
): ServiceName {
  const pathServiceName = getPathServiceName(path);

  const originSources = [xOrigin, origin].filter(
    (source): source is string => !!source && source !== '(same-origin)'
  );
  for (const source of originSources) {
    const originServiceName = getOriginServiceName(source);
    if (originServiceName) return originServiceName;
  }

  if (originSources.length === 0) {
    return pathServiceName || 'Jace-S';
  }

  return pathServiceName || 'Unknown';
}

export interface ApiLogContext {
  method: string;
  path: string;
  origin: string;
  xOrigin: string | null;
  ip: string;
  userAgent: string | null;
  service: ServiceName;
  visitorAddress: Promise<VisitorAddressLog>;
  requestBody?: unknown;
  statusCode?: number;
  error?: string;
  duration?: number;
}

function emptyVisitorAddressLog(): VisitorAddressLog {
  return { address: null, addressDisplayed: false };
}

export function logApiRequest(request: NextRequest, path: string): ApiLogContext {
  const origin = request.headers.get('origin');
  const xOrigin = request.headers.get('x-origin');
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent');
  const method = request.method;
  const actualOrigin = origin || xOrigin || '(same-origin)';
  const service = getServiceName(actualOrigin, xOrigin, path);
  const visitorAddress = isHealthCheckPath(path)
    ? Promise.resolve(emptyVisitorAddressLog())
    : getVisitorAddressLog(request, ip).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logDebug('Visitor access log enrichment failed', { clientIp: ip, error: message });
      return emptyVisitorAddressLog();
    });

  const context: ApiLogContext = {
    method,
    path,
    origin: actualOrigin,
    xOrigin,
    ip,
    userAgent,
    service,
    visitorAddress,
  };

  logDebug('API request received', {
    method: context.method,
    path: context.path,
    origin: context.origin,
    xOrigin: context.xOrigin,
    clientIp: context.ip,
    userAgent: context.userAgent,
    service: context.service,
  });

  return context;
}

function isHealthCheckPath(path: string): boolean {
  return path === '/health';
}

async function getVisitorLogData(
  context: ApiLogContext,
  statusCode: number,
  durationMs: number
): Promise<Record<string, unknown>> {
  const visitorAddress = await context.visitorAddress;

  return {
    service: context.service,
    clientIp: context.ip,
    address: visitorAddress.address,
    addressDisplayed: visitorAddress.addressDisplayed,
    userAgent: context.userAgent,
    method: context.method,
    path: context.path,
    statusCode,
    durationMs,
  };
}

export async function logApiSuccess(
  context: ApiLogContext,
  statusCode: number,
  duration: number
): Promise<void> {
  const logData = await getVisitorLogData(context, statusCode, duration);

  if (isHealthCheckPath(context.path)) {
    logDebug('', logData);
    return;
  }

  logInfo('', logData);
}

export async function logApiError(
  context: ApiLogContext,
  statusCode: number,
  error: Error | string,
  duration: number
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const logData = await getVisitorLogData(context, statusCode, duration);

  if (isHealthCheckPath(context.path)) {
    logDebug(errorMessage, { ...logData, stack: errorStack });
    return;
  }

  logError(errorMessage, { ...logData, stack: errorStack });
}

function getOutcome(statusCode: number): 'success' | 'redirect' | 'denied' | 'error' {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'denied';
  if (statusCode >= 300) return 'redirect';
  return 'success';
}

async function getErrorReason(response: NextResponse): Promise<string | undefined> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.clone().json();
      if (body && typeof body === 'object') {
        const error = (body as { error?: string }).error;
        const details = (body as { details?: string }).details;
        return error || details;
      }
    }
    const text = await response.clone().text();
    return text ? text.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

export async function withApiLogging(
  request: NextRequest,
  path: string,
  handler: (context: ApiLogContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const context = logApiRequest(request, path);

  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method) && request.body) {
    try {
      const clonedRequest = request.clone();
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        context.requestBody = await clonedRequest.json();
      } else {
        const text = await clonedRequest.text();
        context.requestBody = text.length > 10240 ? `${text.slice(0, 10240)}... (truncated)` : text;
      }
    } catch {
      context.requestBody = '(failed to parse body)';
    }
  }

  try {
    const response = await handler(context);
    const duration = Date.now() - startTime;
    const statusCode = response.status;
    const outcome = getOutcome(statusCode);

    if (outcome === 'success' || outcome === 'redirect') {
      await logApiSuccess(context, statusCode, duration);
    } else {
      const errorReason = await getErrorReason(response);
      await logApiError(context, statusCode, errorReason || `HTTP ${statusCode}`, duration);
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error instanceof Error && 'status' in error
      ? (error as { status: number }).status
      : 500;
    await logApiError(context, statusCode, error instanceof Error ? error : String(error), duration);
    throw error;
  }
}
