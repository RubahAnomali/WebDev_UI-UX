import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RequireAuth } from './RequireAuth';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

describe('RequireAuth', () => {
  it('sends signed-out visitors to log in with a return path', async () => {
    renderWithProviders(
      <>
        <Routes>
          <Route
            path="/saved"
            element={
              <RequireAuth>
                <p>Secret</p>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
        <Where />
      </>,
      { route: '/saved' },
    );
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/login?next=%2Fsaved');
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });
});
