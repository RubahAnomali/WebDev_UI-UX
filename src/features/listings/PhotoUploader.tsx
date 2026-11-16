import { useId, useRef, useState } from 'react';
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from '../../../shared/constants';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ApiRequestError } from '../../services/api/client';
import { myListingsService, type EditableListing } from '../../services/listings/myListingsService';
import { ARTWORK } from '../../services/pets/artwork';
import styles from './PhotoUploader.module.css';

type Photo = EditableListing['photos'][number];
type Tone = EditableListing['artworkTone'];

interface PhotoUploaderProps {
  listingId: string;
  petName: string;
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  tone: Tone;
  onToneChange: (tone: Tone) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';
const TONES: { value: Tone; label: string }[] = [
  { value: 'green', label: 'Soft green' },
  { value: 'peach', label: 'Peach' },
  { value: 'lilac', label: 'Lilac' },
  { value: 'sage', label: 'Sage' },
];

/**
 * Real photos (approved design decision) with the Pawhaven paw artwork as the
 * fallback. Photos are re-encoded server-side, which strips location data.
 */
export function PhotoUploader({ listingId, petName, photos, onPhotosChange, tone, onToneChange }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, room);
    const problems: string[] = [];
    if (files.length > room) problems.push(`Only ${MAX_PHOTOS} photos are allowed, so ${files.length - room} weren’t added.`);
    let current = [...photos];
    setUploading(list.length);
    for (const file of list) {
      if (!ACCEPT.split(',').includes(file.type)) {
        problems.push(`${file.name}: use a JPG, PNG, or WebP photo.`);
        setUploading((n) => n - 1);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`${file.name}: photos must be 8 MB or smaller.`);
        setUploading((n) => n - 1);
        continue;
      }
      try {
        const photo = await myListingsService.uploadPhoto(listingId, file);
        current = [...current, photo];
        onPhotosChange(current);
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof ApiRequestError ? err.message : 'upload failed.'}`);
      }
      setUploading((n) => n - 1);
    }
    setErrors(problems);
    setStatus(`${current.length} of ${MAX_PHOTOS} photos added.`);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function remove(photo: Photo) {
    const next = photos.filter((p) => p.id !== photo.id);
    onPhotosChange(next);
    try {
      await myListingsService.deletePhoto(listingId, photo.id);
      setStatus('Photo removed.');
    } catch {
      onPhotosChange(photos);
      setErrors(['We couldn’t remove that photo. Please try again.']);
    }
  }

  async function makeCover(photo: Photo) {
    const next = [photo, ...photos.filter((p) => p.id !== photo.id)];
    onPhotosChange(next);
    try {
      await myListingsService.reorderPhotos(listingId, next.map((p) => p.id));
      setStatus('Cover photo updated.');
    } catch {
      onPhotosChange(photos);
      setErrors(['We couldn’t update the cover photo. Please try again.']);
    }
  }

  return (
    <fieldset className={styles.wrap} aria-describedby={hintId}>
      <legend className={styles.legend}>Photos</legend>
      <p id={hintId} className={styles.hint}>
        Add up to {MAX_PHOTOS} clear, recent photos (JPG, PNG, or WebP, max 8 MB). The first photo is the cover. We remove
        location data from every photo.
      </p>

      <ul role="list" className={styles.grid}>
        {photos.map((p, i) => (
          <li key={p.id} className={styles.item}>
            <img src={p.thumbUrl} alt={`${petName} photo ${i + 1}`} className={styles.thumb} />
            {i === 0 && <span className={styles.cover}>Cover</span>}
            <div className={styles.itemActions}>
              {i > 0 && (
                <button type="button" className={styles.iconButton} onClick={() => makeCover(p)} aria-label={`Make photo ${i + 1} the cover`}>
                  <Icon name="check" size={16} />
                </button>
              )}
              <button type="button" className={styles.iconButton} onClick={() => remove(p)} aria-label={`Remove photo ${i + 1}`}>
                <Icon name="close" size={16} />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`up-${i}`} className={`${styles.item} ${styles.placeholder}`}>
            <Spinner size={24} label="Uploading photo" />
          </li>
        ))}
        {photos.length + uploading < MAX_PHOTOS && (
          <li>
            <label className={styles.add}>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="visually-hidden"
                onChange={(e) => addFiles(e.target.files)}
                disabled={uploading > 0}
              />
              <Icon name="plus" size={22} />
              <span>Add photos</span>
            </label>
          </li>
        )}
      </ul>

      <p className="visually-hidden" role="status">
        {status}
      </p>
      {errors.length > 0 && (
        <ul role="list" className={styles.errors}>
          {errors.map((e) => (
            <li key={e}>
              <Icon name="alert" size={16} /> {e}
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 && (
        <div className={styles.artwork}>
          <div>
            <p className={styles.artTitle}>No photos yet? Your Pawhaven artwork will be used.</p>
            <p className={styles.hint}>Pick a tint for {petName}’s paw artwork. Real photos help people connect, so add some when you can.</p>
          </div>
          <div className={styles.tones} role="radiogroup" aria-label="Artwork tint">
            {TONES.map((t) => (
              <label key={t.value} className={styles.tone}>
                <input
                  type="radio"
                  name="artworkTone"
                  value={t.value}
                  checked={tone === t.value}
                  onChange={() => onToneChange(t.value)}
                  className="visually-hidden"
                />
                <img src={ARTWORK[t.value]} alt="" />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
