import type { ReactNode } from 'react';
import { PageShell } from './PageShell';

/** Inner-page chrome (header + compact footer) for pages with a custom layout. */
export function AppPageShell({ children }: { children: ReactNode }) {
  return <PageShell footer="compact">{children}</PageShell>;
}
