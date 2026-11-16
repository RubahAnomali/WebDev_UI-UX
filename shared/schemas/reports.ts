import { z } from 'zod';
import { REPORT_REASONS } from '../constants';
import { emailSchema } from './auth';

export const reportSchema = z.object({
  targetType: z.enum(['listing', 'user', 'conversation', 'other'], { error: 'Choose what you’re reporting.' }),
  /** A Pawhaven link or id for the listing / conversation. */
  link: z.string().trim().max(300).optional().or(z.literal('')),
  reason: z.enum(REPORT_REASONS, { error: 'Choose a reason.' }),
  details: z
    .string({ error: 'Tell us what happened.' })
    .trim()
    .min(10, 'Please share a little more (10+ characters).')
    .max(2000, 'Please use 2000 characters or fewer.'),
  /** Required only when not signed in. */
  email: emailSchema.optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

/** Pulls a UUID out of a pasted Pawhaven link (or accepts a bare id). */
export function extractId(link: string | undefined | null): string | null {
  const m = link?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}
