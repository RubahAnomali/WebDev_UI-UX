/** Central route map so links never drift from the router. */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  findPet: '/pets',
  howItWorksAnchor: '/#how-it-works',
  about: '/about',
  postPet: '/post-a-pet',
  myListings: '/my-listings',
  rehomingGuide: '/rehoming-guide',
  resources: '/resources',
  safety: '/safety',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  accessibility: '/accessibility',
} as const;

/**
 * Destinations that belong to later phases. They render an honest
 * "coming soon" page instead of a fake implementation.
 */
export const UPCOMING_PAGES: Record<string, { title: string; summary: string }> = {
  [ROUTES.findPet]: {
    title: 'Find a pet',
    summary: 'Search and filter companions by species, location, and listing type.',
  },
  [ROUTES.about]: { title: 'Our mission', summary: 'Why Pawhaven puts pet welfare first.' },
  [ROUTES.postPet]: {
    title: 'Post a pet',
    summary: 'A guided, four-step listing flow with moderation before anything goes public.',
  },
  [ROUTES.myListings]: { title: 'My listings', summary: 'Manage your listings and the people hoping to meet your pets.' },
  [ROUTES.rehomingGuide]: { title: 'Rehoming guide', summary: 'Practical guidance for rehoming a pet responsibly.' },
  [ROUTES.resources]: { title: 'Pet care resources', summary: 'Helpful reading for new and experienced pet parents.' },
  [ROUTES.safety]: {
    title: 'Safety & support',
    summary: 'How to meet safely, spot scams, and report something that doesn’t feel right.',
  },
  [ROUTES.contact]: { title: 'Contact us', summary: 'Get in touch with the Pawhaven team.' },
  [ROUTES.privacy]: { title: 'Privacy policy', summary: 'How Pawhaven collects, uses, and protects your data.' },
  [ROUTES.terms]: { title: 'Terms of use', summary: 'The rules that keep Pawhaven safe for pets and people.' },
  [ROUTES.accessibility]: { title: 'Accessibility', summary: 'Our commitment to an accessible Pawhaven.' },
};
