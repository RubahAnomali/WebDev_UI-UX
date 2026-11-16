import { Route, Routes } from 'react-router-dom';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { HomePage } from './features/home/HomePage';
import { FindPetPage } from './features/pets/FindPetPage';
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
