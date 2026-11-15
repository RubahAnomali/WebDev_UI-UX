import birds from '../../assets/figma/emblem-birds.svg';
import cats from '../../assets/figma/emblem-cats.svg';
import dogs from '../../assets/figma/emblem-dogs.svg';
import small from '../../assets/figma/emblem-small-pets.svg';
import { CategoryCard } from '../../components/pets/CategoryCard';
import { buildSearchUrl } from './PetSearch';
import shared from './HomeSection.module.css';
import styles from './BrowseCategories.module.css';

const CATEGORIES = [
  { type: 'dog', title: 'Dogs', tagline: 'A loyal +1', emblem: dogs, tone: 'green' as const },
  { type: 'cat', title: 'Cats', tagline: 'A little independence', emblem: cats },
  { type: 'small', title: 'Small pets', tagline: 'Small but mighty', emblem: small },
  { type: 'bird', title: 'Birds & more', tagline: 'A different kind of love', emblem: birds },
];

export function BrowseCategories() {
  return (
    <section className={styles.section} aria-labelledby="categories-heading">
      <div className="container">
        <h2 id="categories-heading" className={shared.titleSm}>
          Who’s your kind of companion?
        </h2>
        <ul role="list" className={styles.grid}>
          {CATEGORIES.map((c) => (
            <li key={c.type}>
              <CategoryCard
                title={c.title}
                tagline={c.tagline}
                emblem={c.emblem}
                tone={c.tone}
                href={buildSearchUrl({ type: c.type })}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
