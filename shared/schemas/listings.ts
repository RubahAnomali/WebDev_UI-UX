import { z } from 'zod';
import { GOOD_WITH, LISTING_TYPES, SPECIES } from '../constants';
import { AGE_GROUPS, SEARCH_DISTANCES, SORTS } from '../listings';

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values)));

export const searchQuerySchema = z.object({
  type: csv(SPECIES),
  listing: z.enum(LISTING_TYPES).optional().catch(undefined),
  location: z.string().trim().max(80).optional(),
  near: z
    .string()
    .regex(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/)
    .optional()
    .catch(undefined),
  distance: z.coerce
    .number()
    .refine((n) => (SEARCH_DISTANCES as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
  age: csv(AGE_GROUPS),
  goodWith: csv(GOOD_WITH),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
