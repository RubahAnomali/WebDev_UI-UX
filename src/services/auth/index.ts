import { createHttpAuthAdapter } from './httpAuthAdapter';
import type { AuthService } from './types';

/**
 * The single place that chooses the AuthService implementation.
 * The in-browser demo adapter (`demoAuthAdapter.ts`) is used only by unit tests.
 */
export const authService: AuthService = createHttpAuthAdapter();

export * from './types';
