import { createDemoAuthAdapter } from './demoAuthAdapter';
import type { AuthService } from './types';

/**
 * The single place that chooses the AuthService implementation.
 * Swap `createDemoAuthAdapter()` for an HTTP adapter once the API exists.
 */
export const authService: AuthService = createDemoAuthAdapter();

export * from './types';
