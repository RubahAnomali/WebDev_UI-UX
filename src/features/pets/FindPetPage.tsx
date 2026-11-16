import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GOOD_WITH, SPECIES } from '../../../shared/constants';
import { SEARCH_DISTANCES } from '../../../shared/listings';
import { AppPage } from '../../components/layout/AppPage';
import { PetCard, PetCardSkeleton } from '../../components/pets/PetCard';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { petsService } from '../../services/pets/petsService';
import { useSavedPets } from '../../services/pets/SavedPetsContext';
import type { PetSummary, SearchResult } from '../../services/pets/types';
import styles from './FindPetPage.module.css';

const SPECIES_FILTER: { value: (typeof SPECIES)[number]; label: string }[] = [
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'small', label: 'Small pets' },
  { value: 'bird', label: 'Birds & more' },
];
const AGE_FILTER = [
  { value: 'young', label: 'Young' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
];
const GOOD_WITH_FILTER: { value: (typeof GOOD_WITH)[number]; label: string }[] = [
  { value: 'children', label: 'Children' },
  { value: 'dogs', label: 'Dogs' },
  { value: 'cats', label: 'Cats' },
];
const SORT_OPTIONS = [
  { value: 'nearest', label: 'Nearest first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'fee_low', label: 'Lowest fee' },
];

const list = (params: URLSearchParams, key: string) => (params.get(key) ?? '').split(',').filter(Boolean);

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; result: SearchResult; items: PetSummary[]; loadingMore: boolean };

/** Figma 14:37 — Find a pet. All filters live in the URL so results are shareable. */
export function FindPetPage() {
  const [urlParams, setParams] = useSearchParams();
  // URL updates run inside a transition; mirror them locally so controls respond instantly.
  const [pending, setPending] = useState<URLSearchParams | null>(null);
  if (pending && pending.toString() === urlParams.toString()) setPending(null);
  const params = pending ?? urlParams;
  const { isSaved, toggle } = useSavedPets();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const resultsRef = useRef<HTMLHeadingElement>(null);

  // Search-bar fields are edited locally and applied on "Search pets".
  const [location, setLocation] = useState(params.get('location') ?? '');
  const [distance, setDistance] = useState(params.get('distance') ?? '25');
  const [listing, setListing] = useState(params.get('listing') ?? '');
  const queryKey = params.toString();

  // Keep the search fields in sync when the URL changes (e.g. browser back).
  const [lastKey, setLastKey] = useState(queryKey);
  if (lastKey !== queryKey) {
    setLastKey(queryKey);
    setLocation(params.get('location') ?? (params.get('near') ? 'Current location' : ''));
    setDistance(params.get('distance') ?? '25');
    setListing(params.get('listing') ?? '');
  }

  useEffect(() => {
    const controller = new AbortController();
    const q = new URLSearchParams(queryKey);
    q.delete('page');
    petsService
      .search(q, controller.signal)
      .then((result) => setState({ kind: 'ready', result, items: result.items, loadingMore: false }))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, [queryKey, attempt]);

  function update(mutator: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mutator(next);
    next.delete('page');
    setState({ kind: 'loading' });
    setPending(next);
    setParams(next, { replace: false });
  }

  function toggleListValue(key: string, value: string) {
    update((p) => {
      const current = new Set(list(p, key));
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size) p.set(key, [...current].join(','));
      else p.delete(key);
    });
  }

  function clearList(key: string) {
    update((p) => p.delete(key));
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    update((p) => {
      const loc = location.trim();
      if (loc && loc !== 'Current location') {
        p.set('location', loc);
        p.delete('near');
      } else if (!loc) {
        p.delete('location');
        p.delete('near');
      }
      p.set('distance', distance);
      if (listing) p.set('listing', listing);
      else p.delete('listing');
    });
    resultsRef.current?.focus();
  }

  function resetFilters() {
    update((p) => {
      ['type', 'age', 'goodWith'].forEach((k) => p.delete(k));
    });
  }

  function clearAll() {
    setLocation('');
    setListing('');
    setDistance('25');
    setState({ kind: 'loading' });
    setPending(new URLSearchParams());
    setParams(new URLSearchParams());
  }

  async function loadMore() {
    if (state.kind !== 'ready') return;
    setState({ ...state, loadingMore: true });
    const q = new URLSearchParams(queryKey);
    q.set('page', String(state.result.page + 1));
    try {
      const result = await petsService.search(q);
      setState((s) =>
        s.kind === 'ready' ? { kind: 'ready', result, items: [...s.items, ...result.items], loadingMore: false } : s,
      );
    } catch {
      setState((s) => (s.kind === 'ready' ? { ...s, loadingMore: false } : s));
    }
  }

  function setSort(value: string) {
    update((p) => p.set('sort', value));
  }

  const types = list(params, 'type');
  const ages = list(params, 'age');
  const goodWith = list(params, 'goodWith');
  const activeFilterCount = types.length + ages.length + goodWith.length;
  const hasOrigin = state.kind === 'ready' && state.result.origin;
  const sort = params.get('sort') ?? (hasOrigin ? 'nearest' : 'newest');

  const heading = useMemo(() => {
    if (state.kind !== 'ready') return 'Finding companions…';
    const n = state.result.total;
    const noun = n === 1 ? 'companion' : 'companions';
    const where = state.result.origin ? ` near ${state.result.origin.label}` : params.get('location') ? ` in ${params.get('location')}` : '';
    return `${n} ${noun}${where}`;
  }, [state, params]);

  const hasMore = state.kind === 'ready' && state.items.length < state.result.total;

  return (
    <AppPage title="Your new chapter is out there." documentTitle="Find a pet" subtitle="Find a companion who fits your home, your pace, and your heart.">
      <form className={styles.searchBar} onSubmit={onSearch} role="search" aria-label="Search pets">
        <div className={styles.field}>
          <label htmlFor="fp-location">Location</label>
          <input
            id="fp-location"
            className={styles.input}
            placeholder="City or ZIP code"
            autoComplete="address-level2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="fp-distance">Distance</label>
          <div className={styles.selectWrap}>
            <select id="fp-distance" className={styles.input} value={distance} onChange={(e) => setDistance(e.target.value)}>
              {SEARCH_DISTANCES.map((d) => (
                <option key={d} value={d}>
                  Within {d} miles
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={18} className={styles.chevron} />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="fp-listing">Listing type</label>
          <div className={styles.selectWrap}>
            <select id="fp-listing" className={styles.input} value={listing} onChange={(e) => setListing(e.target.value)}>
              <option value="">Adopt or rehome</option>
              <option value="adoption">Adoption</option>
              <option value="rehoming">Rehoming</option>
            </select>
            <Icon name="chevronDown" size={18} className={styles.chevron} />
          </div>
        </div>
        <Button type="submit" className={styles.searchButton} iconStart={<Icon name="search" size={18} />}>
          Search pets
        </Button>
      </form>

      <div className={styles.layout}>
        <aside className={styles.filtersCol} aria-label="Filters">
          <button
            type="button"
            className={styles.filtersToggle}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span>
              Filters{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
            </span>
            <Icon name="chevronDown" size={18} />
          </button>
          <div id={filtersId} className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ''}`}>
            <div className={styles.filtersHead}>
              <h2 className={styles.filtersTitle}>Filters</h2>
              <button type="button" className={styles.reset} onClick={resetFilters} disabled={activeFilterCount === 0}>
                Reset
              </button>
            </div>

            <fieldset className={styles.group}>
              <legend>Pet type</legend>
              <Checkbox label="All pets" checked={types.length === 0} onChange={() => clearList('type')} className={styles.check} />
              {SPECIES_FILTER.map((o) => (
                <Checkbox
                  key={o.value}
                  label={o.label}
                  checked={types.includes(o.value)}
                  onChange={() => toggleListValue('type', o.value)}
                  className={styles.check}
                />
              ))}
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Age</legend>
              <Checkbox label="Any age" checked={ages.length === 0} onChange={() => clearList('age')} className={styles.check} />
              {AGE_FILTER.map((o) => (
                <Checkbox
                  key={o.value}
                  label={o.label}
                  checked={ages.includes(o.value)}
                  onChange={() => toggleListValue('age', o.value)}
                  className={styles.check}
                />
              ))}
              <p className={styles.groupHint}>Young: under 1 year · Senior: 8+ years</p>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Good with</legend>
              {GOOD_WITH_FILTER.map((o) => (
                <Checkbox
                  key={o.value}
                  label={o.label}
                  checked={goodWith.includes(o.value)}
                  onChange={() => toggleListValue('goodWith', o.value)}
                  className={styles.check}
                />
              ))}
            </fieldset>
          </div>
        </aside>

        <section className={styles.results} aria-labelledby="fp-results">
          <div className={styles.resultsHead}>
            <h2 id="fp-results" ref={resultsRef} tabIndex={-1} className={styles.resultsTitle} aria-live="polite">
              {heading}
            </h2>
            <label className={styles.sort}>
              <span>Sort:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort results">
                {SORT_OPTIONS.filter((o) => o.value !== 'nearest' || hasOrigin).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} />
            </label>
          </div>

          {state.kind === 'ready' && state.items.some((p) => p.isSample) && (
            <p className={styles.sampleNote}>
              <Icon name="info" size={16} />
              Includes sample listings for demonstration — not real pets available for adoption.
            </p>
          )}

          {state.kind === 'loading' && (
            <ul role="list" className={styles.grid} aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <PetCardSkeleton variant="browse" />
                </li>
              ))}
            </ul>
          )}

          {state.kind === 'error' && (
            <EmptyState
              title="Let’s try that again."
              text="We couldn’t load companions right now. Check your connection and try again."
              action={
                <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </Button>
              }
            />
          )}

          {state.kind === 'ready' && state.items.length === 0 && (
            <EmptyState
              title="No matches just yet."
              text={
                <>
                  Try a wider distance or remove a filter.
                  <br />
                  Your companion could be a little further away.
                </>
              }
              action={
                <Button variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          )}

          {state.kind === 'ready' && state.items.length > 0 && (
            <>
              <ul role="list" className={styles.grid}>
                {state.items.map((pet) => (
                  <li key={pet.id}>
                    <PetCard pet={pet} variant="browse" saved={isSaved(pet.id)} onToggleSave={toggle} />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className={styles.more}>
                  <Button variant="secondary" size="lg" onClick={loadMore} loading={state.loadingMore} loadingText="Loading…">
                    Load more companions
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AppPage>
  );
}
