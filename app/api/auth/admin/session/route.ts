import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, setCorsHeaders } from '@/app/utils/corsUtils';
import { withApiLogging } from '@/app/utils/apiLogger';
import { getAdminSession, setAdminCsrfCookie } from '@/app/utils/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createUnauthenticatedResponse(): NextResponse {
  const response = NextResponse.json(
    { error: 'UNAUTHENTICATED' },
    { status: 401 }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  return withApiLogging(request, '/api/auth/admin/session', async () => {
    const session = getAdminSession(request);
    if (!session) {
      return setCorsHeaders(request, createUnauthenticatedResponse());
    }

    const response = NextResponse.json(
      {
        authenticated: true,
        expiresAt: session.expiresAt,
      },
      { status: 200 }
    );
    response.headers.set('Cache-Control', 'no-store');
    if (!request.cookies.get('admin_csrf')?.value) {
      setAdminCsrfCookie(response);
    }
    return setCorsHeaders(request, response);
  });
}
