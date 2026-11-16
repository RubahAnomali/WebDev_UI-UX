import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ROUTES } from '../../lib/routes';
import { ContentPage } from './ContentPage';
import styles from './InfoPages.module.css';

const SafetyAside = () => (
  <>
    <p className={styles.asideTitle}>Something doesn’t feel right?</p>
    <p className={styles.asideText}>Reports are private and reviewed by our moderation team.</p>
    <Button to={`${ROUTES.safety}#report`} block>
      Report a concern
    </Button>
  </>
);

export function AboutPage() {
  return (
    <ContentPage
      title="More than a match. A new beginning."
      documentTitle="Our mission"
      subtitle="Pawhaven helps companions find loving homes — thoughtfully, safely, and with their welfare first."
      aside={
        <>
          <p className={styles.asideTitle}>Ready to meet someone new?</p>
          <Button to={ROUTES.findPet} block>
            Find a pet
          </Button>
        </>
      }
      sections={[
        {
          heading: 'Why Pawhaven exists',
          body: (
            <p>
              Every year, pets need new homes because of moves, allergies, new jobs, or life simply changing. Shelters and rescues do
              heroic work, and many pet parents want to rehome responsibly but don’t know where to start. Pawhaven brings both together
              in one calm, trustworthy place.
            </p>
          ),
        },
        {
          heading: 'A match, not a transaction',
          body: (
            <>
              <p>
                Pawhaven is not a marketplace. We never process payments, fees are capped and clearly labelled, and every listing is
                reviewed by a person before it goes live.
              </p>
              <ul>
                <li>Adoption requests start conversations — not purchases.</li>
                <li>Shelters and rescues are verified before their listings go live.</li>
                <li>Private details stay private until you choose to share them.</li>
              </ul>
            </>
          ),
        },
        {
          heading: 'What we won’t allow',
          body: (
            <p>
              No wildlife or endangered animals, no breeding or resale operations, no pet shipping, and no deposits before meeting. When
              something doesn’t feel right, our moderation team steps in.
            </p>
          ),
        },
      ]}
    />
  );
}

export function RehomingGuidePage() {
  return (
    <ContentPage
      title="Rehoming with care."
      documentTitle="Rehoming guide"
      subtitle="A thoughtful checklist for finding your pet the right next home."
      aside={
        <>
          <p className={styles.asideTitle}>When you’re ready</p>
          <p className={styles.asideText}>Our four-step listing flow walks you through everything an adopter needs to know.</p>
          <Button to={ROUTES.postPet} block>
            Post a pet
          </Button>
        </>
      }
      sections={[
        {
          heading: '1. Explore every option first',
          body: (
            <p>
              Talk to your vet, trainer, or local rescue — many challenges (behavior, allergies, housing rules) have solutions. If you
              adopted from a shelter, check your contract: many ask you to return the pet to them.
            </p>
          ),
        },
        {
          heading: '2. Be honest in your listing',
          body: (
            <ul>
              <li>Share health, behavior, and care needs — including the hard parts.</li>
              <li>Select “Unknown” when you aren’t sure.</li>
              <li>Keep phone numbers, addresses, and links out of the public description.</li>
              <li>Keep any rehoming fee modest. It helps show commitment; it isn’t a sale.</li>
            </ul>
          ),
        },
        {
          heading: '3. Screen thoughtfully',
          body: (
            <p>
              Read each adoption request carefully, ask questions in Messages, and invite promising matches to meet. Trust your instincts —
              you know your pet best.
            </p>
          ),
        },
        {
          heading: '4. Meet safely and hand over with care',
          body: (
            <ul>
              <li>Meet in a public place first, and bring a friend.</li>
              <li>Share vet records, food, and favourite toys to ease the transition.</li>
              <li>Transfer microchip registration to the new family.</li>
              <li>Mark your listing as rehomed so no one else is left waiting.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}

export function ResourcesPage() {
  return (
    <ContentPage
      title="A little care goes a long way."
      documentTitle="Pet care resources"
      subtitle="Helpful starting points for new and experienced pet parents."
      sections={[
        {
          heading: 'The first two weeks',
          body: (
            <p>
              Give your new companion a quiet space, a steady routine, and time. Many pets need days or weeks to decompress. Keep
              introductions to other pets slow and supervised.
            </p>
          ),
        },
        {
          heading: 'Health basics',
          body: (
            <ul>
              <li>Book a vet visit within the first two weeks.</li>
              <li>Keep vaccinations, parasite prevention, and dental care up to date.</li>
              <li>Update microchip details with your contact information.</li>
            </ul>
          ),
        },
        {
          heading: 'Getting help',
          body: (
            <p>
              Your vet, a certified trainer, or the shelter you adopted from are your best first calls. For emergencies, contact your local
              emergency veterinary hospital.
            </p>
          ),
        },
      ]}
    />
  );
}

export function ContactPage() {
  return (
    <ContentPage
      title="We’re here to help."
      documentTitle="Contact us"
      subtitle="The quickest way to reach the Pawhaven team."
      aside={<SafetyAside />}
      sections={[
        {
          heading: 'Report a listing, member, or conversation',
          body: (
            <p>
              Use the report form on <Link to={`${ROUTES.safety}#report`}>Safety &amp; support</Link>. Reports are private and reviewed by
              our moderation team, and you’ll get an email confirming we received it.
            </p>
          ),
        },
        {
          heading: 'Account help',
          body: (
            <p>
              You can update your details, change your password or email, export your data, or delete your account from{' '}
              <Link to={ROUTES.account}>Account &amp; privacy</Link>. Locked out? <Link to={ROUTES.forgotPassword}>Reset your password</Link>.
            </p>
          ),
        },
        {
          heading: 'Shelters & rescues',
          body: (
            <p>
              Create a Shelter / rescue account to start. We verify every organization before its listings go live and will contact you by
              email if we need more information.
            </p>
          ),
        },
        {
          heading: 'Emergencies',
          body: <p>If an animal is in immediate danger, contact local animal welfare authorities or emergency services first.</p>,
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <ContentPage
      draft
      title="Terms of use."
      documentTitle="Terms of use"
      subtitle="The rules that keep Pawhaven safe for pets and people."
      updated="November 2026 (draft)"
      sections={[
        {
          heading: 'Who can use Pawhaven',
          body: <p>You must be 18 or older and provide accurate information. One person, one account. Shelters and rescues must be verified.</p>,
        },
        {
          heading: 'Listings',
          body: (
            <ul>
              <li>List only pets you legally own or are authorized to represent.</li>
              <li>Describe health and behavior honestly. Fees must be clearly labelled and may not exceed the listed cap.</li>
              <li>No wildlife, endangered or prohibited animals, breeding operations, resale, or shipping.</li>
              <li>Every listing is reviewed before publication and may be removed if it breaks these rules.</li>
            </ul>
          ),
        },
        {
          heading: 'Adoption requests and messages',
          body: (
            <p>
              Requests and messages must be respectful and relevant. Never request or send deposits before meeting. Harassment, scams, or
              attempts to move payments off-platform lead to removal.
            </p>
          ),
        },
        {
          heading: 'Payments',
          body: <p>Pawhaven does not process payments and is not a party to any adoption agreement between members.</p>,
        },
        {
          heading: 'Enforcement',
          body: <p>We may remove content, suspend, or close accounts that put animals or people at risk. Moderation decisions are recorded.</p>,
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <ContentPage
      draft
      title="Your privacy."
      documentTitle="Privacy policy"
      subtitle="What we collect, why, and the choices you have."
      updated="November 2026 (draft)"
      sections={[
        {
          heading: 'What we collect',
          body: (
            <ul>
              <li>Account details: name, email, city or ZIP, and an optional phone number.</li>
              <li>Content you create: listings, photos, adoption requests, messages, and reports.</li>
              <li>Basic security data such as session cookies and IP addresses for abuse prevention.</li>
            </ul>
          ),
        },
        {
          heading: 'What others can see',
          body: (
            <p>
              Your public profile shows your first name and city only. Exact addresses are never displayed. When you send an adoption
              request, the details in it — including your email and phone — are shared with that lister only.
            </p>
          ),
        },
        {
          heading: 'Photos',
          body: <p>Uploaded photos are re-encoded, which removes hidden location (GPS) data and other metadata.</p>,
        },
        {
          heading: 'Cookies',
          body: <p>We use essential cookies to keep you signed in and protect forms. We don’t use advertising cookies.</p>,
        },
        {
          heading: 'Your choices',
          body: (
            <p>
              From <Link to={ROUTES.account}>Account &amp; privacy</Link> you can update your details, choose email notifications, download a
              copy of your data, or delete your account.
            </p>
          ),
        },
      ]}
    />
  );
}

export function AccessibilityPage() {
  return (
    <ContentPage
      title="Pawhaven for everyone."
      documentTitle="Accessibility"
      subtitle="Our commitment to an accessible experience."
      sections={[
        {
          heading: 'Our approach',
          body: (
            <p>
              We aim to meet WCAG 2.2 AA. Pawhaven is built with semantic HTML, works with a keyboard and screen readers, respects reduced
              motion settings, and never relies on colour alone to convey meaning.
            </p>
          ),
        },
        {
          heading: 'What we test',
          body: (
            <ul>
              <li>Keyboard navigation and visible focus on every page.</li>
              <li>Form labels, error messages, and live status updates.</li>
              <li>Layouts from small phones to large desktops.</li>
            </ul>
          ),
        },
        {
          heading: 'Tell us what we can do better',
          body: (
            <p>
              If something is hard to use, please let us know through the <Link to={`${ROUTES.safety}#report`}>support form</Link> (choose
              “Something else”).
            </p>
          ),
        },
      ]}
    />
  );
}
