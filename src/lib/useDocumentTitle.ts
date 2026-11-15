import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Pawhaven` : 'Pawhaven — A best friend. A fresh start.';
  }, [title]);
}
