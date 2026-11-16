import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import { useAuth } from '../auth/AuthContext';
import { petsService } from './petsService';

interface SavedPetsValue {
  isSaved: (id: string) => boolean;
  /** Toggles a saved pet. Signed-out visitors are sent to log in first. */
  toggle: (pet: { id: string; name: string }) => Promise<void>;
}

const SavedPetsContext = createContext<SavedPetsValue | null>(null);

export function SavedPetsProvider({ children }: { children: ReactNode }) {
  const { user, service } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!user || service.isDemo) return;
    let active = true;
    petsService
      .savedIds()
      .then((list) => active && setIds(new Set(list)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, service]);

  const effectiveIds = useMemo(() => (user ? ids : new Set<string>()), [user, ids]);

  const toggle = useCallback(
    async (pet: { id: string; name: string }) => {
      if (!user) {
        // Return to the exact card after logging in.
        const next = `${location.pathname}${location.search}#pet-${pet.id}-name`;
        navigate(`${ROUTES.login}?next=${encodeURIComponent(next)}`, { state: { reason: 'save' } });
        return;
      }
      const willSave = !effectiveIds.has(pet.id);
      const apply = (save: boolean) =>
        setIds((prev) => {
          const n = new Set(prev);
          if (save) n.add(pet.id);
          else n.delete(pet.id);
          return n;
        });
      apply(willSave); // optimistic
      try {
        await petsService.setSaved(pet.id, willSave);
        setAnnouncement(willSave ? `${pet.name} saved.` : `${pet.name} removed from saved pets.`);
      } catch {
        apply(!willSave);
        setAnnouncement(`Couldn’t update ${pet.name}. Please try again.`);
      }
    },
    [user, effectiveIds, location, navigate],
  );

  const value = useMemo(() => ({ isSaved: (id: string) => effectiveIds.has(id), toggle }), [effectiveIds, toggle]);

  return (
    <SavedPetsContext.Provider value={value}>
      {children}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </SavedPetsContext.Provider>
  );
}

export function useSavedPets(): SavedPetsValue {
  const ctx = useContext(SavedPetsContext);
  if (!ctx) throw new Error('useSavedPets must be used inside <SavedPetsProvider>');
  return ctx;
}
