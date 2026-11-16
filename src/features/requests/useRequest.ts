import { useCallback, useEffect, useState } from 'react';
import { requestsService, type MyRequest } from '../../services/requests/requestsService';

export type RequestState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; request: MyRequest };

/** Loads one of the signed-in person's adoption requests. */
export function useMyRequest(id: string) {
  const [state, setState] = useState<RequestState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    requestsService
      .get(id, controller.signal)
      .then((request) => setState({ kind: 'ready', request }))
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setState({ kind: 'missing' });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { state, setState, reload };
}
