import { beforeEach, describe, expect, it } from 'vitest';
import { __resetMemoryStorage } from '../../lib/storage';
import { createDemoAuthAdapter, readDemoOutbox } from './demoAuthAdapter';
import { AuthError } from './types';

const input = {
  fullName: 'Alex Morgan',
  email: 'Alex@Example.com',
  password: 'Sunny-window-42',
  location: 'Austin, TX',
  accountType: 'individual' as const,
  acceptedTerms: true,
};

function tokenFrom(link: string | undefined) {
  return new URL(link!).searchParams.get('token')!;
}

describe('demo auth adapter', () => {
  let clock = 1_800_000_000_000;
  const now = () => clock;
  beforeEach(() => {
    __resetMemoryStorage();
    clock = 1_800_000_000_000;
  });

  it('runs register → verify → login → logout', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);

    await expect(auth.login({ email: input.email, password: input.password, remember: false })).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });

    const verifyMail = readDemoOutbox().find((m) => m.subject.includes('Verify'));
    expect(verifyMail?.to).toBe('alex@example.com');
    const user = await auth.verifyEmail(tokenFrom(verifyMail?.link));
    expect(user.emailVerified).toBe(true);
    expect(user.roles).toEqual(['member']);
    expect(user).not.toHaveProperty('passwordHash');

    const loggedIn = await auth.login({ email: 'alex@example.com', password: input.password, remember: true });
    expect(loggedIn.fullName).toBe('Alex Morgan');
    expect(await auth.getCurrentUser()).toMatchObject({ email: 'alex@example.com' });

    await auth.logout();
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it('never grants seller or admin at sign-up; shelters are pending verification', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register({ ...input, email: 'rescue@example.com', accountType: 'organization' });
    const mail = readDemoOutbox()[0];
    const user = await auth.verifyEmail(tokenFrom(mail?.link));
    expect(user.roles).toEqual(['member']);
    expect(user.organizationVerification).toBe('pending');
  });

  it('returns the same error for unknown email and wrong password', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);
    const unknown = await auth.login({ email: 'nobody@example.com', password: 'x', remember: false }).catch((e) => e);
    const wrong = await auth.login({ email: input.email, password: 'wrong', remember: false }).catch((e) => e);
    expect(unknown).toBeInstanceOf(AuthError);
    expect(unknown.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.message).toBe(wrong.message);
  });

  it('does not reveal existing accounts on registration', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);
    await expect(auth.register(input)).resolves.toEqual({ email: 'alex@example.com' });
    expect(readDemoOutbox()[0]?.subject).toMatch(/someone tried/i);
  });

  it('gives a neutral response to password reset requests', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await expect(auth.requestPasswordReset('ghost@example.com')).resolves.toBeUndefined();
    expect(readDemoOutbox()).toHaveLength(0);
  });

  it('resets a password with a single-use, expiring token', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);
    await auth.requestPasswordReset(input.email);
    const token = tokenFrom(readDemoOutbox().find((m) => m.subject.includes('Reset'))?.link);

    await expect(auth.checkResetToken(token)).resolves.toBeUndefined();
    await auth.resetPassword(token, 'New-sunny-window-7');
    await expect(auth.resetPassword(token, 'Another-pass-99!')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });

    const user = await auth.login({ email: input.email, password: 'New-sunny-window-7', remember: false });
    expect(user.emailVerified).toBe(true);

    await auth.requestPasswordReset(input.email);
    const late = tokenFrom(readDemoOutbox().find((m) => m.subject.includes('Reset'))?.link);
    clock += 31 * 60 * 1000;
    await expect(auth.checkResetToken(late)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('rate-limits verification resends to one per 60 seconds', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);
    await expect(auth.resendVerification(input.email)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 60 });
    clock += 61_000;
    await expect(auth.resendVerification(input.email)).resolves.toEqual({ retryAfter: 60 });
  });

  it('expires verification links after 24 hours', async () => {
    const auth = createDemoAuthAdapter({ latency: 0, now });
    await auth.register(input);
    const token = tokenFrom(readDemoOutbox()[0]?.link);
    clock += 25 * 60 * 60 * 1000;
    await expect(auth.verifyEmail(token)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });
});
