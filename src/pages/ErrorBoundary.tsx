import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '../components/ui/Icon';
import styles from './StatusPage.module.css';

interface State {
  error: Error | null;
}

/**
 * Last-resort safety net: if rendering throws, show a calm recovery page
 * (outside the router, so it works even if routing itself failed).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for error tracking (e.g. Sentry) in production.
    console.error('Pawhaven crashed while rendering', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className={`container ${styles.wrap}`} aria-labelledby="crash-title">
        <Icon name="paw" size={56} className={styles.icon} />
        <p className={styles.kicker}>Something went wrong</p>
        <h1 id="crash-title" className={styles.title}>
          Let’s try that again.
        </h1>
        <p className={styles.text}>An unexpected error stopped this page from loading. Your information is safe.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <a href="/" className={styles.buttonSecondary}>
            Back to Pawhaven
          </a>
        </div>
      </main>
    );
  }
}
