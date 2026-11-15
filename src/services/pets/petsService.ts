import { readJSON, writeJSON } from '../../lib/storage';
import { SAMPLE_FEATURED_PETS } from './sampleData';
import type { PetSummary } from './types';

export interface PetsService {
  /** True while listings come from bundled sample data. */
  readonly isSample: boolean;
  getFeatured(signal?: AbortSignal): Promise<PetSummary[]>;
}

type DemoState = 'ok' | 'empty' | 'error' | 'slow';

/**
 * In development you can preview the section's states with
 * `/?demoState=empty|error|slow`.
 */
function demoState(): DemoState {
  if (!import.meta.env.DEV) return 'ok';
  const v = new URLSearchParams(window.location.search).get('demoState');
  return v === 'empty' || v === 'error' || v === 'slow' ? v : 'ok';
}

export function createSamplePetsService(latency = 500): PetsService {
  return {
    isSample: true,
    getFeatured(signal) {
      const state = demoState();
      const delay = state === 'slow' ? 4000 : latency;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          if (state === 'error') reject(new Error('Unable to load companions right now.'));
          else resolve(state === 'empty' ? [] : SAMPLE_FEATURED_PETS);
        }, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    },
  };
}

export const petsService = createSamplePetsService();

/* ---------- Saved pets (per user, local until the favorites API exists) ---------- */

const savedKey = (userId: string) => `pawhaven.demo.saved.${userId}`;

export function getSavedPetIds(userId: string): string[] {
  return readJSON<string[]>(savedKey(userId), []);
}

export function toggleSavedPet(userId: string, petId: string): boolean {
  const current = new Set(getSavedPetIds(userId));
  const saved = !current.has(petId);
  if (saved) current.add(petId);
  else current.delete(petId);
  writeJSON(savedKey(userId), [...current]);
  return saved;
}
