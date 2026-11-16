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
  saved: '/saved',
  messages: '/messages',
  requests: '/requests',
  account: '/account',
  admin: '/admin',
} as const;

export const petPath = (id: string) => `/pets/${id}`;
export const applyPath = (id: string) => `/pets/${id}/apply`;
export const requestPath = (id: string) => `/requests/${id}`;
export const messageListingPath = (listingId: string) => `/messages?listing=${listingId}`;
export const conversationPath = (id: string) => `/messages/${id}`;
export const reportPath = (type: 'listing' | 'user' | 'conversation', id: string) =>
  `/safety?report=${type}&id=${encodeURIComponent(id)}#report`;
export const editListingPath = (id: string) => `/post-a-pet/${id}`;
export const listingRequestsPath = (id: string) => `/my-listings/${id}/requests`;

/**
 * Destinations that belong to later phases. They render an honest
 * "coming soon" page instead of a fake implementation.
 */
export const UPCOMING_PAGES: Record<string, { title: string; summary: string }> = {
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

/** Signed-in destinations still being built; guarded so they require an account. */
export const UPCOMING_PRIVATE_PAGES: Record<string, { title: string; summary: string; role?: 'admin' }> = {
  [ROUTES.messages]: { title: 'Messages', summary: 'Questions, updates, and meet-and-greet plans in one safe place.' },
  [ROUTES.requests]: { title: 'My adoption requests', summary: 'Track every adoption request you’ve sent.' },
  [ROUTES.account]: { title: 'Account & privacy', summary: 'Keep your profile current and choose what you share.' },
  [ROUTES.admin]: { title: 'Moderation workspace', summary: 'Care behind every connection.', role: 'admin' },
};
