import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { containsContactInfo } from '../../../shared/schemas/listingForm';
import { extractId } from '../../../shared/schemas/reports';
import { ErrorBoundary } from '../../pages/ErrorBoundary';
import { looksRisky } from '../../services/messages/messagesService';
import { feeLabel } from '../../services/pets/petsService';
import { StatusPill, statusLabel } from './StatusPill';
import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes switch semantics and toggles', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch label="Pet discovery emails" description="Occasional recommendations." checked={on} onChange={setOn} />;
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Pet discovery emails' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Occasional recommendations.');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('labels', () => {
  it('labels fees by listing type (approved design decision)', () => {
    expect(feeLabel(150, 'adoption')).toMatchObject({ kind: 'Adoption fee', amount: '$150' });
    expect(feeLabel(50, 'rehoming')).toMatchObject({ kind: 'Rehoming fee', amount: '$50' });
    expect(feeLabel(0, 'adoption').amount).toBe('No fee');
  });

  it('uses friendly status names', () => {
    expect(statusLabel('pending')).toBe('In review');
    expect(statusLabel('meet_invited')).toBe('Meet & greet');
    render(<StatusPill status="changes_requested" />);
    expect(screen.getByText('Changes requested')).toBeInTheDocument();
  });
});

describe('trust & safety helpers', () => {
  it.each([
    ['Call me at (512) 555-0142', true],
    ['email finn@example.com', true],
    ['see www.example.com', true],
    ['Venmo me the fee', true],
    ['Finn loves sunny windows and gentle play.', false],
    ['He is 2 years old and weighs 10 lbs', false],
  ])('flags contact details in “%s”: %s', (text, expected) => {
    expect(containsContactInfo(text)).toBe(expected);
  });

  it('warns on scam-like phrases in messages', () => {
    expect(looksRisky('Please send a deposit via Zelle to hold her')).toBe(true);
    expect(looksRisky('We can ship the pet to you')).toBe(true);
    expect(looksRisky('Could we meet at the park on Saturday?')).toBe(false);
  });

  it('extracts ids from pasted links', () => {
    expect(extractId('https://pawhaven.example/pets/0F2B1C3D-1111-4222-8333-444455556666?x=1')).toBe('0f2b1c3d-1111-4222-8333-444455556666');
    expect(extractId('not a link')).toBeNull();
  });
});

describe('ErrorBoundary', () => {
  it('shows a recovery page instead of a blank screen', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Boom(): never {
      throw new Error('kaboom');
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Let’s try that again.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
