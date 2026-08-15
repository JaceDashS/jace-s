import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { POST as adminLogin } from '../app/api/auth/admin/login/route';
import { POST as legacyLogin } from '../app/api/auth/verify-password/route';
import { GET as adminSession } from '../app/api/auth/admin/session/route';
import { POST as adminLogout } from '../app/api/auth/admin/logout/route';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_COOKIE,
  clearAdminLoginRateLimit,
  createAdminSession,
  getAdminSession,
  hasValidAdminCsrf,
  consumeAdminLoginRateLimit,
  setAdminCsrfCookie,
} from '../app/utils/adminAuth';
import { hashPassword } from '../app/utils/passwordUtils';

function createRequest(
  path: string,
  cookie = '',
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      'x-forwarded-for': '198.51.100.10',
      'x-vercel-ip-city': 'Test City',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
  });
}

function createLoginRequest(password: string, ip: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      'x-vercel-ip-city': 'Test City',
    },
    body: JSON.stringify({ password }),
  });
}

async function main(): Promise<void> {
  process.env.LOG_LEVEL = 'error';

  const originalHash = process.env.ADMIN_PASSWORD_HASH;
  const originalPepper = process.env.PEPPER;
  const originalSameSite = process.env.ADMIN_SESSION_SAME_SITE;
  process.env.ADMIN_SESSION_SAME_SITE = 'strict';
  process.env.PEPPER = randomBytes(24).toString('base64url');
  const testPassword = randomBytes(24).toString('base64url');
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(testPassword);

  try {
    const invalidLogin = await adminLogin(
      createLoginRequest(`${testPassword}-invalid`, '198.51.100.11')
    );
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.cookies.get(ADMIN_SESSION_COOKIE), undefined);

    const validLogin = await adminLogin(
      createLoginRequest(testPassword, '198.51.100.12')
    );
    assert.equal(validLogin.status, 204);
    const sessionId = validLogin.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const csrfToken = validLogin.cookies.get(ADMIN_CSRF_COOKIE)?.value;
    assert.ok(sessionId);
    assert.ok(csrfToken);

    const cookie = `${ADMIN_SESSION_COOKIE}=${sessionId}; ${ADMIN_CSRF_COOKIE}=${csrfToken}`;
    const sessionResponse = await adminSession(
      createRequest('/api/auth/admin/session', cookie)
    );
    assert.equal(sessionResponse.status, 200);
    assert.equal((await sessionResponse.json()).authenticated, true);

    const legacyResponse = await legacyLogin(
      createLoginRequest(testPassword, '198.51.100.13')
    );
    assert.equal(legacyResponse.status, 204);
    assert.equal(legacyResponse.headers.get('Deprecation'), 'true');

    const logoutResponse = await adminLogout(
      createRequest('/api/auth/admin/logout', cookie)
    );
    assert.equal(logoutResponse.status, 204);
    assert.equal(
      (await adminSession(createRequest('/api/auth/admin/session', cookie))).status,
      401
    );
    assert.equal(
      (await adminLogout(createRequest('/api/auth/admin/logout', cookie))).status,
      204
    );

    const rateLimitIp = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(consumeAdminLoginRateLimit(rateLimitIp).allowed, true);
    }
    assert.equal(consumeAdminLoginRateLimit(rateLimitIp).allowed, false);
    clearAdminLoginRateLimit(rateLimitIp);
    assert.equal(consumeAdminLoginRateLimit(rateLimitIp).allowed, true);

    const session = createAdminSession();
    const originalNow = Date.now;
    Date.now = () => session.expiresAt + 1;
    try {
      assert.equal(
        getAdminSession(createRequest('', `${ADMIN_SESSION_COOKIE}=${session.sessionId}`)),
        null
      );
    } finally {
      Date.now = originalNow;
    }

    process.env.ADMIN_SESSION_SAME_SITE = 'none';
    const csrfResponse = NextResponse.json({ ok: true });
    setAdminCsrfCookie(csrfResponse, randomUUID());
    const utilityCsrfToken = csrfResponse.cookies.get(ADMIN_CSRF_COOKIE)?.value;
    assert.ok(utilityCsrfToken);
    const csrfCookie = `${ADMIN_CSRF_COOKIE}=${utilityCsrfToken}`;
    assert.equal(
      hasValidAdminCsrf(createRequest('', csrfCookie, { [ADMIN_CSRF_HEADER]: utilityCsrfToken })),
      true
    );
    assert.equal(hasValidAdminCsrf(createRequest('', csrfCookie)), false);
    assert.equal(
      hasValidAdminCsrf(createRequest('', csrfCookie, { [ADMIN_CSRF_HEADER]: 'invalid' })),
      false
    );
  } finally {
    if (originalHash === undefined) {
      delete process.env.ADMIN_PASSWORD_HASH;
    } else {
      process.env.ADMIN_PASSWORD_HASH = originalHash;
    }
    if (originalPepper === undefined) {
      delete process.env.PEPPER;
    } else {
      process.env.PEPPER = originalPepper;
    }
    if (originalSameSite === undefined) {
      delete process.env.ADMIN_SESSION_SAME_SITE;
    } else {
      process.env.ADMIN_SESSION_SAME_SITE = originalSameSite;
    }
    clearAdminLoginRateLimit('198.51.100.11');
    clearAdminLoginRateLimit('198.51.100.12');
    clearAdminLoginRateLimit('198.51.100.13');
  }

  console.log('Admin authentication tests passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
