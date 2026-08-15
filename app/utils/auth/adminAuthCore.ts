import { createHash, randomBytes } from 'node:crypto';

export interface AdminSession {
  createdAt: number;
  expiresAt: number;
}

export interface LoginRateLimitEntry {
  attempts: number;
  windowStartedAt: number;
  blockedUntil: number | null;
}

export interface AdminSessionStore {
  get(sessionHash: string): AdminSession | undefined;
  set(sessionHash: string, session: AdminSession): void;
  delete(sessionHash: string): void;
  pruneExpired?(now: number): void;
}

export interface LoginRateLimitStore {
  get(ip: string): LoginRateLimitEntry | undefined;
  set(ip: string, entry: LoginRateLimitEntry): void;
  delete(ip: string): void;
}

export interface AdminAuthCoreOptions {
  sessionStore: AdminSessionStore;
  loginRateLimitStore: LoginRateLimitStore;
  passwordVerifier: (password: string) => Promise<boolean>;
  sessionTtlMs: number;
  loginRateLimitWindowMs: number;
  loginRateLimitMaxAttempts: number;
  loginRateLimitBlockMs: number;
  now?: () => number;
}

export interface AdminAuthCore {
  consumeLoginRateLimit(ip: string): {
    allowed: boolean;
    retryAfterSeconds?: number;
  };
  clearLoginRateLimit(ip: string): void;
  verifyPassword(password: string): Promise<boolean>;
  createSession(): { sessionId: string; expiresAt: number };
  getSession(sessionId: string): AdminSession | null;
  revokeSession(sessionId: string): void;
}

export class InMemoryAdminSessionStore implements AdminSessionStore {
  private readonly sessions = new Map<string, AdminSession>();

  get(sessionHash: string): AdminSession | undefined {
    return this.sessions.get(sessionHash);
  }

  set(sessionHash: string, session: AdminSession): void {
    this.sessions.set(sessionHash, session);
  }

  delete(sessionHash: string): void {
    this.sessions.delete(sessionHash);
  }

  pruneExpired(now: number): void {
    for (const [sessionHash, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionHash);
      }
    }
  }
}

export class InMemoryLoginRateLimitStore implements LoginRateLimitStore {
  private readonly entries = new Map<string, LoginRateLimitEntry>();

  get(ip: string): LoginRateLimitEntry | undefined {
    return this.entries.get(ip);
  }

  set(ip: string, entry: LoginRateLimitEntry): void {
    this.entries.set(ip, entry);
  }

  delete(ip: string): void {
    this.entries.delete(ip);
  }
}

function hashOpaqueValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function createAdminAuthCore(
  options: AdminAuthCoreOptions
): AdminAuthCore {
  const now = options.now ?? (() => Date.now());

  return {
    consumeLoginRateLimit(ip) {
      const currentTime = now();
      const store = options.loginRateLimitStore;
      const existing = store.get(ip);

      if (
        !existing ||
        currentTime - existing.windowStartedAt >= options.loginRateLimitWindowMs
      ) {
        store.set(ip, {
          attempts: 1,
          windowStartedAt: currentTime,
          blockedUntil: null,
        });
        return { allowed: true };
      }

      if (existing.blockedUntil && existing.blockedUntil > currentTime) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(
            (existing.blockedUntil - currentTime) / 1000
          ),
        };
      }

      if (existing.attempts >= options.loginRateLimitMaxAttempts) {
        const blockedUntil = currentTime + options.loginRateLimitBlockMs;
        store.set(ip, { ...existing, blockedUntil });
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(
            options.loginRateLimitBlockMs / 1000
          ),
        };
      }

      store.set(ip, {
        ...existing,
        attempts: existing.attempts + 1,
      });
      return { allowed: true };
    },

    clearLoginRateLimit(ip) {
      options.loginRateLimitStore.delete(ip);
    },

    verifyPassword(password) {
      return options.passwordVerifier(password);
    },

    createSession() {
      const sessionId = randomBytes(32).toString('base64url');
      const currentTime = now();
      const expiresAt = currentTime + options.sessionTtlMs;

      options.sessionStore.set(hashOpaqueValue(sessionId), {
        createdAt: currentTime,
        expiresAt,
      });

      return { sessionId, expiresAt };
    },

    getSession(sessionId) {
      if (!sessionId) {
        return null;
      }

      const currentTime = now();
      options.sessionStore.pruneExpired?.(currentTime);
      const sessionHash = hashOpaqueValue(sessionId);
      const session = options.sessionStore.get(sessionHash);

      if (!session || session.expiresAt <= currentTime) {
        if (session) {
          options.sessionStore.delete(sessionHash);
        }
        return null;
      }

      return session;
    },

    revokeSession(sessionId) {
      if (sessionId) {
        options.sessionStore.delete(hashOpaqueValue(sessionId));
      }
    },
  };
}
