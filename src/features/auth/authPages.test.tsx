import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { VerifyEmailPage } from './VerifyEmailPage';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}</p>;
}

function AuthRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Routes>
      <Where />
    </>
  );
}

describe('Login page', () => {
  it('shows field errors and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthRoutes />, { route: '/login' });
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();
  });

  it('shows a generic error for bad credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthRoutes />, { route: '/login' });
    await user.type(screen.getByLabelText('Email address'), 'nobody@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'whatever-123!');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email or password is incorrect/i);
  });

  it('links to registration and forgot password', () => {
    renderWithProviders(<AuthRoutes />, { route: '/login' });
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
  });
});

describe('Registration flow', () => {
  it('registers with a role choice and lands on verify email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthRoutes />, { route: '/register' });

    const shelter = screen.getByRole('radio', { name: 'Shelter / rescue' });
    await user.click(shelter);
    expect(shelter).toBeChecked();
    expect(screen.getByText(/verify your organization/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Shelter or rescue name'), 'Happy Tails Rescue');
    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText('Email address'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Sunny-window-42');
    expect(screen.getByRole('meter', { name: /password strength/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText('City or ZIP code'), 'Austin, TX');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/verify-email'));
    expect(screen.getByRole('heading', { name: 'Check your inbox.' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend available in/i })).toBeDisabled();
    expect(await screen.findByRole('link', { name: /open link from email/i })).toBeInTheDocument();
  });

  it('requires consent', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthRoutes />, { route: '/register' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/confirm you’re 18 or older/i)).toBeInTheDocument();
  });
});

describe('Forgot password', () => {
  it('always shows the neutral confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthRoutes />, { route: '/forgot-password' });
    await user.type(screen.getByLabelText('Email address'), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email.' })).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
  });
});
