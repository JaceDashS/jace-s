import type { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import {
  createAdminAuthCore,
  InMemoryAdminSessionStore,
  InMemoryLoginRateLimitStore,
  type AdminAuthCore,
  type AdminSession,
} from './auth/adminAuthCore';
import { comparePassword } from './passwordUtils';
import { getClientIP } from './requestUtils';
import { logError } from './logging';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_CSRF_COOKIE = 'admin_csrf';
export const ADMIN_CSRF_HEADER = 'x-csrf-token';
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

const SESSION_TTL_MS = ADMIN_SESSION_TTL_SECONDS * 1000;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;
const CSRF_TOKEN_BYTES = 32;

declare global {
  var __jaceSAdminAuthCore: AdminAuthCore | undefined;
}

function getCookieSameSite(): 'strict' | 'lax' | 'none' {
  const configured = process.env.ADMIN_SESSION_SAME_SITE?.trim().toLowerCase();
  if (configured === 'lax' || configured === 'none' || configured === 'strict') {
    return configured;
  }
  return 'strict';
}

function getCookieSecure(sameSite: 'strict' | 'lax' | 'none'): boolean {
  if (sameSite === 'none' || process.env.NODE_ENV === 'production') {
    return true;
  }
  return process.env.ADMIN_SESSION_SECURE?.trim().toLowerCase() === 'true';
}

function createCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
}

async function verifyConfiguredAdminPassword(password: string): Promise<boolean> {
  const storedPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!storedPasswordHash) {
    logError('Admin password hash is not configured');
    return false;
  }

  try {
    return await comparePassword(password, storedPasswordHash);
  } catch (error) {
    logError('Admin password comparison failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function getAdminAuthCore(): AdminAuthCore {
  if (!globalThis.__jaceSAdminAuthCore) {
    globalThis.__jaceSAdminAuthCore = createAdminAuthCore({
      sessionStore: new InMemoryAdminSessionStore(),
      loginRateLimitStore: new InMemoryLoginRateLimitStore(),
      passwordVerifier: verifyConfiguredAdminPassword,
      sessionTtlMs: SESSION_TTL_MS,
      loginRateLimitWindowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
      loginRateLimitMaxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      loginRateLimitBlockMs: LOGIN_RATE_LIMIT_BLOCK_MS,
    });
  }

  return globalThis.__jaceSAdminAuthCore;
}

export function isAdminCsrfRequired(): boolean {
  return getCookieSameSite() === 'none';
}

function hashCsrfToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function hasValidAdminCsrf(request: NextRequest): boolean {
  if (!isAdminCsrfRequired()) {
    return true;
  }

  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(ADMIN_CSRF_HEADER);
  if (!cookieToken || !headerToken) {
    return false;
  }

  const expected = hashCsrfToken(cookieToken);
  const actual = hashCsrfToken(headerToken);
  return timingSafeEqual(expected, actual);
}

export function consumeAdminLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  return getAdminAuthCore().consumeLoginRateLimit(ip);
}

export function clearAdminLoginRateLimit(ip: string): void {
  getAdminAuthCore().clearLoginRateLimit(ip);
}

export function verifyAdminPassword(password: string): Promise<boolean> {
  return getAdminAuthCore().verifyPassword(password);
}

export function createAdminSession(): { sessionId: string; expiresAt: number } {
  return getAdminAuthCore().createSession();
}

export function getAdminSession(request: NextRequest): AdminSession | null {
  const sessionId = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return sessionId ? getAdminAuthCore().getSession(sessionId) : null;
}

export function revokeAdminSession(request: NextRequest): void {
  const sessionId = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionId) {
    getAdminAuthCore().revokeSession(sessionId);
  }
}

export function setAdminSessionCookie(
  response: NextResponse,
  sessionId: string,
  expiresAt: number
): void {
  const sameSite = getCookieSameSite();
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: getCookieSecure(sameSite),
    sameSite,
    path: '/',
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  });
}

export function setAdminCsrfCookie(
  response: NextResponse,
  token: string = createCsrfToken()
): void {
  const sameSite = getCookieSameSite();
  response.cookies.set({
    name: ADMIN_CSRF_COOKIE,
    value: token,
    httpOnly: false,
    secure: getCookieSecure(sameSite),
    sameSite,
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  const sameSite = getCookieSameSite();
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: getCookieSecure(sameSite),
    sameSite,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export function clearAdminCsrfCookie(response: NextResponse): void {
  const sameSite = getCookieSameSite();
  response.cookies.set({
    name: ADMIN_CSRF_COOKIE,
    value: '',
    httpOnly: false,
    secure: getCookieSecure(sameSite),
    sameSite,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export function getAdminRequestIP(request: NextRequest): string {
  return getClientIP(request);
}
