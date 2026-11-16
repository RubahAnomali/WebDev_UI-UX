import { Route, Routes } from 'react-router-dom';
import { AccountPage } from './features/account/AccountPage';
import { ConfirmEmailPage } from './features/account/ConfirmEmailPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { HomePage } from './features/home/HomePage';
import { ListingSubmittedPage } from './features/listings/ListingSubmittedPage';
import { MyListingsPage } from './features/listings/MyListingsPage';
import { PostPetPage } from './features/listings/PostPetPage';
import { MessagesPage } from './features/messages/MessagesPage';
import { FindPetPage } from './features/pets/FindPetPage';
import { ApplyPage } from './features/requests/ApplyPage';
import { ListingRequestsPage } from './features/requests/ListingRequestsPage';
import { MyRequestsPage } from './features/requests/MyRequestsPage';
import { RequestSentPage } from './features/requests/RequestSentPage';
import { RequestStatusPage } from './features/requests/RequestStatusPage';
import { PetProfilePage } from './features/pets/PetProfilePage';
import { SavedPetsPage } from './features/pets/SavedPetsPage';
import { RequireAuth } from './components/layout/RequireAuth';
import { ROUTES, UPCOMING_PAGES, UPCOMING_PRIVATE_PAGES } from './lib/routes';
import { ScrollManager } from './lib/ScrollManager';
import { SessionWatcher } from './lib/SessionWatcher';
import { ComingSoon } from './pages/ComingSoon';
import { NotAllowed } from './pages/NotAllowed';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <>
      <ScrollManager />
      <SessionWatcher />
      <Routes>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />

        {/* Later-phase destinations: honest placeholders, no fake functionality. */}
        {Object.keys(UPCOMING_PAGES).map((path) => (
          <Route key={path} path={path} element={<ComingSoon />} />
        ))}
        <Route path={ROUTES.findPet} element={<FindPetPage />} />
        <Route path={`${ROUTES.findPet}/:petId`} element={<PetProfilePage />} />
        <Route
          path={ROUTES.postPet}
          element={
            <RequireAuth>
              <PostPetPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.postPet}/:listingId`}
          element={
            <RequireAuth>
              <PostPetPage key="edit" />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.postPet}/:listingId/submitted`}
          element={
            <RequireAuth>
              <ListingSubmittedPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.myListings}
          element={
            <RequireAuth>
              <MyListingsPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.findPet}/:petId/apply`}
          element={
            <RequireAuth>
              <ApplyPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.requests}
          element={
            <RequireAuth>
              <MyRequestsPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.requests}/:requestId`}
          element={
            <RequireAuth>
              <RequestStatusPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.requests}/:requestId/sent`}
          element={
            <RequireAuth>
              <RequestSentPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.myListings}/:listingId/requests`}
          element={
            <RequireAuth>
              <ListingRequestsPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.messages}
          element={
            <RequireAuth>
              <MessagesPage />
            </RequireAuth>
          }
        />
        <Route
          path={`${ROUTES.messages}/:conversationId`}
          element={
            <RequireAuth>
              <MessagesPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.account}
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route
          path={ROUTES.saved}
          element={
            <RequireAuth>
              <SavedPetsPage />
            </RequireAuth>
          }
        />

        {Object.entries(UPCOMING_PRIVATE_PAGES).map(([path, page]) => (
          <Route
            key={path}
            path={path}
            element={
              <RequireAuth role={page.role}>
                <ComingSoon />
              </RequireAuth>
            }
          />
        ))}
        <Route path="/not-allowed" element={<NotAllowed />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
