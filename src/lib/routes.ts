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
  notifications: '/notifications',
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
