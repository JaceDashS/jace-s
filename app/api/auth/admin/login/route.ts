import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { withApiLogging } from '@/app/utils/apiLogger';
import {
  clearAdminLoginRateLimit,
  consumeAdminLoginRateLimit,
  createAdminSession,
  getAdminRequestIP,
  revokeAdminSession,
  setAdminCsrfCookie,
  setAdminSessionCookie,
  verifyAdminPassword,
} from '@/app/utils/adminAuth';
import { logAdminAudit } from '@/app/utils/adminAudit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createInvalidCredentialsResponse(): NextResponse {
  const response = NextResponse.json(
    { error: 'INVALID_CREDENTIALS' },
    { status: 401 }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/auth/admin/login', async () => {
    const ip = getAdminRequestIP(request);
    const rateLimit = consumeAdminLoginRateLimit(ip);

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        { error: 'RATE_LIMITED' },
        { status: 429 }
      );
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set(
        'Retry-After',
        String(rateLimit.retryAfterSeconds || 900)
      );
      return setCorsHeaders(request, response);
    }

    let password: unknown;
    try {
      const body = await request.json() as { password?: unknown };
      password = body.password;
    } catch {
      logAdminAudit('admin_login_failed', { ip, result: 'invalid_request' });
      return setCorsHeaders(request, createInvalidCredentialsResponse());
    }

    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
      logAdminAudit('admin_login_failed', { ip, result: 'invalid_request' });
      return setCorsHeaders(request, createInvalidCredentialsResponse());
    }

    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      logAdminAudit('admin_login_failed', { ip, result: 'invalid_credentials' });
      return setCorsHeaders(request, createInvalidCredentialsResponse());
    }

    clearAdminLoginRateLimit(ip);
    revokeAdminSession(request);
    const session = createAdminSession();
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Cache-Control', 'no-store');
    setAdminSessionCookie(response, session.sessionId, session.expiresAt);
    setAdminCsrfCookie(response);
    logAdminAudit('admin_login_succeeded', { ip, result: 'authenticated' });
    return setCorsHeaders(request, response);
  });
}
