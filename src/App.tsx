import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/layout/RequireAuth';
import { AccountPage } from './features/account/AccountPage';
import { ConfirmEmailPage } from './features/account/ConfirmEmailPage';
import { AdminAuditPage, AdminMembersPage, AdminOrganizationsPage, AdminReportsPage } from './features/admin/AdminPages';
import { ReviewQueuePage } from './features/admin/ReviewQueuePage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { HomePage } from './features/home/HomePage';
import {
  AboutPage,
  AccessibilityPage,
  ContactPage,
  PrivacyPage,
  RehomingGuidePage,
  ResourcesPage,
  TermsPage,
} from './features/info/InfoPages';
import { SafetyPage } from './features/info/SafetyPage';
import { ListingSubmittedPage } from './features/listings/ListingSubmittedPage';
import { MyListingsPage } from './features/listings/MyListingsPage';
import { PostPetPage } from './features/listings/PostPetPage';
import { MessagesPage } from './features/messages/MessagesPage';
import { FindPetPage } from './features/pets/FindPetPage';
import { PetProfilePage } from './features/pets/PetProfilePage';
import { SavedPetsPage } from './features/pets/SavedPetsPage';
import { ApplyPage } from './features/requests/ApplyPage';
import { ListingRequestsPage } from './features/requests/ListingRequestsPage';
import { MyRequestsPage } from './features/requests/MyRequestsPage';
import { RequestSentPage } from './features/requests/RequestSentPage';
import { RequestStatusPage } from './features/requests/RequestStatusPage';
import { ROUTES } from './lib/routes';
import { ScrollManager } from './lib/ScrollManager';
import { SessionWatcher } from './lib/SessionWatcher';
import { NotAllowed } from './pages/NotAllowed';
import { NotFound } from './pages/NotFound';

/** Signed-in only. The guard shapes the UI; the API enforces access on every request. */
const member = (page: ReactNode) => <RequireAuth>{page}</RequireAuth>;
/** Staff only (admin role is assigned server-side via the CLI, never through sign-up). */
const staff = (page: ReactNode) => <RequireAuth role="admin">{page}</RequireAuth>;

export function App() {
  return (
    <>
      <ScrollManager />
      <SessionWatcher />
      <Routes>
        {/* Public */}
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.findPet} element={<FindPetPage />} />
        <Route path={`${ROUTES.findPet}/:petId`} element={<PetProfilePage />} />
        <Route path={ROUTES.safety} element={<SafetyPage />} />
        <Route path={ROUTES.about} element={<AboutPage />} />
        <Route path={ROUTES.rehomingGuide} element={<RehomingGuidePage />} />
        <Route path={ROUTES.resources} element={<ResourcesPage />} />
        <Route path={ROUTES.contact} element={<ContactPage />} />
        <Route path={ROUTES.terms} element={<TermsPage />} />
        <Route path={ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={ROUTES.accessibility} element={<AccessibilityPage />} />

        {/* Authentication */}
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />

        {/* Members */}
        <Route path={ROUTES.saved} element={member(<SavedPetsPage />)} />
        <Route path={`${ROUTES.findPet}/:petId/apply`} element={member(<ApplyPage />)} />
        <Route path={ROUTES.requests} element={member(<MyRequestsPage />)} />
        <Route path={`${ROUTES.requests}/:requestId`} element={member(<RequestStatusPage />)} />
        <Route path={`${ROUTES.requests}/:requestId/sent`} element={member(<RequestSentPage />)} />
        <Route path={ROUTES.messages} element={member(<MessagesPage />)} />
        <Route path={`${ROUTES.messages}/:conversationId`} element={member(<MessagesPage />)} />
        <Route path={ROUTES.account} element={member(<AccountPage />)} />

        {/* Listing owners */}
        <Route path={ROUTES.postPet} element={member(<PostPetPage />)} />
        <Route path={`${ROUTES.postPet}/:listingId`} element={member(<PostPetPage key="edit" />)} />
        <Route path={`${ROUTES.postPet}/:listingId/submitted`} element={member(<ListingSubmittedPage />)} />
        <Route path={ROUTES.myListings} element={member(<MyListingsPage />)} />
        <Route path={`${ROUTES.myListings}/:listingId/requests`} element={member(<ListingRequestsPage />)} />

        {/* Staff */}
        <Route path={ROUTES.admin} element={staff(<ReviewQueuePage />)} />
        <Route path={`${ROUTES.admin}/reports`} element={staff(<AdminReportsPage />)} />
        <Route path={`${ROUTES.admin}/organizations`} element={staff(<AdminOrganizationsPage />)} />
        <Route path={`${ROUTES.admin}/members`} element={staff(<AdminMembersPage />)} />
        <Route path={`${ROUTES.admin}/audit`} element={staff(<AdminAuditPage />)} />

        <Route path="/not-allowed" element={<NotAllowed />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
