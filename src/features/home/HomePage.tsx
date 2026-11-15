import { PageShell } from '../../components/layout/PageShell';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { BrowseCategories } from './BrowseCategories';
import { CommunityCta } from './CommunityCta';
import { FeaturedPets } from './FeaturedPets';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { PetSearch } from './PetSearch';
import { SafetyPanel } from './SafetyPanel';

/** Figma 6:2 — Homepages. */
export function HomePage() {
  useDocumentTitle('');
  return (
    <PageShell>
      <Hero />
      <PetSearch />
      <BrowseCategories />
      <FeaturedPets />
      <HowItWorks />
      <SafetyPanel />
      <CommunityCta />
    </PageShell>
  );
}
