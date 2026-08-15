import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { withApiLogging } from '@/app/utils/apiLogger';
import {
  clearAdminCsrfCookie,
  clearAdminSessionCookie,
  getAdminRequestIP,
  getAdminSession,
  hasValidAdminCsrf,
  revokeAdminSession,
} from '@/app/utils/adminAuth';
import { logAdminAudit } from '@/app/utils/adminAudit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  return withApiLogging(request, '/api/auth/admin/logout', async () => {
    const ip = getAdminRequestIP(request);
    const session = getAdminSession(request);

    if (session && !hasValidAdminCsrf(request)) {
      const response = NextResponse.json(
        { error: 'CSRF_VALIDATION_FAILED' },
        { status: 403 }
      );
      response.headers.set('Cache-Control', 'no-store');
      return setCorsHeaders(request, response);
    }

    revokeAdminSession(request);

    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Cache-Control', 'no-store');
    clearAdminSessionCookie(response);
    clearAdminCsrfCookie(response);
    logAdminAudit('admin_logout', { ip, result: 'completed' });
    return setCorsHeaders(request, response);
  });
}
