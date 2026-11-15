import { Route, Routes } from 'react-router-dom';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { HomePage } from './features/home/HomePage';
import { ROUTES, UPCOMING_PAGES } from './lib/routes';
import { ScrollManager } from './lib/ScrollManager';
import { ComingSoon } from './pages/ComingSoon';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <>
      <ScrollManager />
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
        <Route
          path={`${ROUTES.findPet}/:petId`}
          element={<ComingSoon title="Pet profile" summary="Full profiles with health, care needs, and how to apply." />}
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
