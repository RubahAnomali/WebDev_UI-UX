import stepChapter from '../../assets/figma/step-chapter.svg';
import stepFind from '../../assets/figma/step-find.svg';
import stepMeet from '../../assets/figma/step-meet.svg';
import shared from './HomeSection.module.css';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    icon: stepFind,
    title: 'Find your connection',
    text: 'Browse pets by location, personality, and needs. There’s someone for every kind of home.',
  },
  {
    icon: stepMeet,
    title: 'Get to know each other',
    text: 'Chat with the shelter or pet parent. Ask questions and arrange a safe, in-person meet-and-greet.',
  },
  {
    icon: stepChapter,
    title: 'Start your next chapter',
    text: 'Make sure it’s the right fit, complete the paperwork, and help your new companion settle in.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-heading" tabIndex={-1}>
      <div className="container">
        <header className={styles.header}>
          <h2 id="how-heading" className={shared.title}>
            A small step for you. A new world for them.
          </h2>
          <p className={styles.sub}>Your journey to a new best friend starts here.</p>
        </header>
        <ol role="list" className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <div className={styles.stepTop}>
                <img src={step.icon} alt="" width={48} height={48} />
                <span className={styles.number} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className={styles.stepTitle}>
                <span className="visually-hidden">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
