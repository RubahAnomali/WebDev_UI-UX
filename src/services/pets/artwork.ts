import green from '../../assets/figma/pet-luna.svg';
import peach from '../../assets/figma/pet-milo.svg';
import sage from '../../assets/figma/pet-teddy.svg';
import lilac from '../../assets/figma/pet-willow.svg';
import type { ArtworkTone } from './types';

/** Tinted paw artwork from Figma, used when a listing has no photo. */
export const ARTWORK: Record<ArtworkTone, string> = { green, peach, lilac, sage };

export const artworkFor = (tone: ArtworkTone | null | undefined) => ARTWORK[tone ?? 'green'] ?? green;
