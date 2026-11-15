import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createDemoAuthAdapter } from '../services/auth/demoAuthAdapter';
import { AuthProvider } from '../services/auth/AuthContext';
import type { AuthService } from '../services/auth/types';

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', service = createDemoAuthAdapter({ latency: 0 }) }: { route?: string; service?: AuthService } = {},
) {
  return {
    service,
    ...render(
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider service={service}>{ui}</AuthProvider>
      </MemoryRouter>,
    ),
  };
}
