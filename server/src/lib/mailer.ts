import nodemailer from 'nodemailer';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
  link?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Development / test mailer: stores messages in `dev_outbox` instead of sending them. */
export function createOutboxMailer(db: DB): Mailer {
  return {
    async send(m) {
      await db
        .insertInto('dev_outbox')
        .values({ to_email: m.to, subject: m.subject, body: m.body, link: m.link ?? null })
        .execute();
      if (config.isDev) console.info(`[mail] ${m.to} — ${m.subject}${m.link ? `\n       ${m.link}` : ''}`);
    },
  };
}

export function createSmtpMailer(url: string): Mailer {
  const transport = nodemailer.createTransport(url);
  return {
    async send(m) {
      await transport.sendMail({
        from: config.mailFrom,
        to: m.to,
        subject: m.subject,
        text: m.link ? `${m.body}\n\n${m.link}\n\n— Pawhaven` : `${m.body}\n\n— Pawhaven`,
      });
    },
  };
}

export function createMailer(db: DB): Mailer {
  return config.smtpUrl ? createSmtpMailer(config.smtpUrl) : createOutboxMailer(db);
}
