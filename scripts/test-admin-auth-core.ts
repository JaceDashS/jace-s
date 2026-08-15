import assert from 'node:assert/strict';
import {
  createAdminAuthCore,
  InMemoryAdminSessionStore,
  InMemoryLoginRateLimitStore,
} from '../app/utils/auth/adminAuthCore';

async function main(): Promise<void> {
  let currentTime = 1_000_000;
  const core = createAdminAuthCore({
    sessionStore: new InMemoryAdminSessionStore(),
    loginRateLimitStore: new InMemoryLoginRateLimitStore(),
    passwordVerifier: async (password) => password === 'correct-password',
    sessionTtlMs: 1_000,
    loginRateLimitWindowMs: 10_000,
    loginRateLimitMaxAttempts: 2,
    loginRateLimitBlockMs: 5_000,
    now: () => currentTime,
  });

  assert.equal(await core.verifyPassword('wrong-password'), false);
  assert.equal(await core.verifyPassword('correct-password'), true);

  const session = core.createSession();
  assert.equal(core.getSession(session.sessionId)?.expiresAt, session.expiresAt);

  assert.equal(core.consumeLoginRateLimit('198.51.100.20').allowed, true);
  assert.equal(core.consumeLoginRateLimit('198.51.100.20').allowed, true);
  assert.equal(core.consumeLoginRateLimit('198.51.100.20').allowed, false);

  core.revokeSession(session.sessionId);
  assert.equal(core.getSession(session.sessionId), null);

  const expiringSession = core.createSession();
  currentTime += 1_001;
  assert.equal(core.getSession(expiringSession.sessionId), null);

  console.log('Admin authentication core tests passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
