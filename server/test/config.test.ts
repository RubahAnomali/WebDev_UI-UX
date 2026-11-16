import { describe, expect, it } from 'vitest';
import { config, productionConfigProblems } from '../src/config.ts';

const prod = {
  ...config,
  isProd: true,
  smtpUrl: 'smtp://token:token@smtp.postmarkapp.com:587',
  mailFrom: 'Pawhaven <hello@pawhaven.org>',
  appOrigin: 'https://pawhaven.onrender.com',
  cookieSecure: true,
  allowDevMailbox: false,
};

describe('production configuration guard', () => {
  it('accepts a complete production setup', () => {
    expect(productionConfigProblems(prod)).toEqual([]);
  });

  it('ignores development', () => {
    expect(productionConfigProblems({ ...prod, isProd: false, smtpUrl: undefined })).toEqual([]);
  });

  it('refuses to run without real email unless explicitly allowed', () => {
    expect(productionConfigProblems({ ...prod, smtpUrl: undefined })[0]).toMatch(/SMTP_URL/);
    expect(productionConfigProblems({ ...prod, smtpUrl: undefined, allowDevMailbox: true })).toEqual([]);
  });

  it('requires a real sender and public https origin', () => {
    expect(productionConfigProblems({ ...prod, mailFrom: 'Pawhaven <hello@pawhaven.local>' })[0]).toMatch(/MAIL_FROM/);
    expect(productionConfigProblems({ ...prod, appOrigin: 'http://localhost:5173' }).join(' ')).toMatch(/APP_ORIGIN/);
    expect(productionConfigProblems({ ...prod, appOrigin: 'http://pawhaven.example' })[0]).toMatch(/https/);
  });
});
