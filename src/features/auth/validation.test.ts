import { describe, expect, it } from 'vitest';
import { evaluatePassword } from './passwordStrength';
import { safeRedirectPath, validateEmail, validateLogin, validateNewPassword, validateRegister, validateReset } from './validation';

describe('evaluatePassword', () => {
  it('scores an empty password as 0 and invalid', () => {
    const r = evaluatePassword('');
    expect(r.score).toBe(0);
    expect(r.valid).toBe(false);
  });

  it('requires 12+ chars, a number and a symbol', () => {
    expect(evaluatePassword('short1!').valid).toBe(false);
    expect(evaluatePassword('longenoughpassword').valid).toBe(false);
    expect(evaluatePassword('longenough123').valid).toBe(false);
    expect(evaluatePassword('Sunny-window-42').valid).toBe(true);
  });

  it('never rates an invalid password above Fair', () => {
    expect(evaluatePassword('abcdefghijklmnopQRST').score).toBeLessThanOrEqual(2);
  });

  it('rates a long mixed password as Strong', () => {
    const r = evaluatePassword('Golden-Retriever-2026!');
    expect(r.score).toBe(4);
    expect(r.label).toBe('Strong password');
  });

  it('penalises common words even when rules are met', () => {
    expect(evaluatePassword('Password1234!').score).toBe(2);
  });
});

describe('field validation', () => {
  it('validates email format', () => {
    expect(validateEmail('')).toMatch(/enter your email/i);
    expect(validateEmail('alex@')).toMatch(/valid email/i);
    expect(validateEmail('  alex@example.com ')).toBeUndefined();
  });

  it('explains which password rule is missing', () => {
    expect(validateNewPassword('')).toMatch(/create a password/i);
    expect(validateNewPassword('abc')).toMatch(/12 characters/);
    expect(validateNewPassword('abcdefghijkl!')).toMatch(/number/);
    expect(validateNewPassword('abcdefghijkl1')).toMatch(/symbol/);
  });

  it('login requires email and password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
  });

  it('registration requires consent and all fields', () => {
    const errors = validateRegister({ fullName: '', email: 'x', password: 'weak', location: '', consent: false });
    expect(Object.keys(errors).sort()).toEqual(['consent', 'email', 'fullName', 'location', 'password']);
    expect(
      validateRegister({
        fullName: 'Alex Morgan',
        email: 'alex@example.com',
        password: 'Sunny-window-42',
        location: 'Austin, TX',
        consent: true,
      }),
    ).toEqual({});
  });

  it('reset requires matching passwords', () => {
    expect(validateReset({ password: 'Sunny-window-42', confirm: 'Sunny-window-43' }).confirm).toMatch(/match/);
    expect(validateReset({ password: 'Sunny-window-42', confirm: 'Sunny-window-42' })).toEqual({});
  });
});

describe('safeRedirectPath', () => {
  it('allows same-origin paths', () => {
    expect(safeRedirectPath('/pets?type=dog')).toBe('/pets?type=dog');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/login', null])(
    'rejects %s',
    (value) => {
      expect(safeRedirectPath(value)).toBe('/');
    },
  );
});
