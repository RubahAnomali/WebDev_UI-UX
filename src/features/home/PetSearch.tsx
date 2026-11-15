import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ROUTES } from '../../lib/routes';
import styles from './PetSearch.module.css';

export const SPECIES_OPTIONS = [
  { value: '', label: 'All pets' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'small', label: 'Small pets' },
  { value: 'bird', label: 'Birds & more' },
] as const;

export const LISTING_OPTIONS = [
  { value: '', label: 'Adopt or rehome' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'rehoming', label: 'Rehoming' },
] as const;

type GeoState = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

/** Builds the Find-a-pet URL from the search fields (only non-empty params). */
export function buildSearchUrl(fields: { type?: string; location?: string; listing?: string; near?: string }) {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => {
    if (v && v.trim()) params.set(k, v.trim());
  });
  const qs = params.toString();
  return qs ? `${ROUTES.findPet}?${qs}` : ROUTES.findPet;
}

export function PetSearch() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [listing, setListing] = useState('');
  const [geo, setGeo] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<string>('');

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Round to ~1 km so we never pass a precise position around.
        setCoords(`${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`);
        setLocation('Current location');
        setGeo('located');
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const usingCoords = geo === 'located' && location === 'Current location';
    navigate(
      buildSearchUrl({
        type,
        listing,
        location: usingCoords ? '' : location,
        near: usingCoords ? coords : '',
      }),
    );
  }

  const geoMessage = {
    idle: '',
    locating: 'Finding your location…',
    located: 'Using your approximate location.',
    denied: 'Location access is off. Type a city or ZIP code instead.',
    unavailable: 'We couldn’t get your location. Type a city or ZIP code instead.',
  }[geo];

  return (
    <section className={styles.section} aria-labelledby="search-heading">
      <div className="container">
        <h2 id="search-heading" className="visually-hidden">
          Find your companion
        </h2>
        <form className={styles.bar} role="search" aria-label="Search pets" onSubmit={onSubmit}>
          <div className={styles.segment}>
            <Icon name="paw" size={30} className={styles.leadIcon} />
            <div className={styles.fieldStack}>
              <label htmlFor="search-type" className={styles.label}>
                I’m looking for
              </label>
              <div className={styles.selectWrap}>
                <select id="search-type" className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
                  {SPECIES_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={20} className={styles.chevron} />
              </div>
            </div>
          </div>

          <div className={`${styles.segment} ${styles.locationSegment}`}>
            <button
              type="button"
              className={styles.locate}
              onClick={useMyLocation}
              aria-label="Use my current location"
              title="Use my current location"
              disabled={geo === 'locating'}
            >
              {geo === 'locating' ? <Spinner size={20} /> : <Icon name="pin" size={24} />}
            </button>
            <div className={styles.fieldStack}>
              <label htmlFor="search-location" className={styles.label}>
                Near me
              </label>
              <input
                id="search-location"
                className={styles.input}
                type="text"
                placeholder="City or ZIP code"
                autoComplete="address-level2"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (geo === 'located') setGeo('idle');
                }}
                aria-describedby="search-geo-status"
              />
            </div>
          </div>

          <div className={styles.segment}>
            <div className={styles.fieldStack}>
              <label htmlFor="search-listing" className={styles.label}>
                A new beginning
              </label>
              <div className={styles.selectWrap}>
                <select
                  id="search-listing"
                  className={styles.select}
                  value={listing}
                  onChange={(e) => setListing(e.target.value)}
                >
                  {LISTING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={20} className={styles.chevron} />
              </div>
            </div>
          </div>

          <button type="submit" className={styles.submit}>
            <Icon name="search" size={20} />
            <span>Search pets</span>
          </button>
        </form>
        <p id="search-geo-status" className={styles.geo} role="status">
          {geoMessage}
        </p>
      </div>
    </section>
  );
}
