import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { pet } from '../../test/fixtures';

vi.mock('../../services/pets/petsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/pets/petsService')>();
  return {
    ...actual,
    petsService: { ...actual.petsService, getFeatured: () => Promise.resolve([pet()]) },
  };
});
import { renderWithProviders } from '../../test/renderWithProviders';
import { HomePage } from './HomePage';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function Harness() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<p>Elsewhere</p>} />
      </Routes>
      <Where />
    </>
  );
}

describe('HomePage', () => {
  it('renders every Figma section', async () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: /a best friend\.\s*a fresh start\./i })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: /search pets/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /who’s your kind of companion/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a few faces/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a small step for you/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /good homes\. thoughtful connections/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /their person is out there/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Luna' }, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText(/sample listings for demonstration/i)).toBeInTheDocument();
    expect(screen.getByText('Adoption fee')).toBeInTheDocument();
  });

  it('search submits filters to the Find a pet route', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const search = screen.getByRole('search');
    await user.selectOptions(within(search).getByLabelText('I’m looking for'), 'cat');
    await user.type(within(search).getByLabelText('Near me'), 'Austin, TX');
    await user.selectOptions(within(search).getByLabelText('A new beginning'), 'rehoming');
    await user.click(within(search).getByRole('button', { name: 'Search pets' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/pets?type=cat&listing=rehoming&location=Austin%2C+TX');
  });

  it('asks signed-out visitors to log in before saving a pet', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(await screen.findByRole('button', { name: 'Save Luna' }, { timeout: 2000 }));
    expect(screen.getByTestId('where')).toHaveTextContent('/login?next=');
  });
});
