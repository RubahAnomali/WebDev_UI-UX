import type { ReactNode } from 'react';
import { CompactFooter } from './CompactFooter';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function PageShell({ children, footer = 'full' }: { children: ReactNode; footer?: 'full' | 'compact' }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {footer === 'full' ? <SiteFooter /> : <CompactFooter />}
    </>
  );
}
