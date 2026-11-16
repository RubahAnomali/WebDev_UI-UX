import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { relativeTime } from '../../lib/relativeTime';
import { NotificationBell } from './NotificationBell';

function mockApi(items: unknown[]) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = url.startsWith('/api/auth/csrf') ? { token: 't' } : init?.method === 'POST' ? { updated: 1 } : { items, unread: 1 };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

const ITEM = {
  id: '1',
  type: 'request_new',
  title: 'New adoption request for Finn',
  body: 'From Jamie.',
  link: '/my-listings/abc/requests',
  read: false,
  createdAt: new Date().toISOString(),
};

describe('NotificationBell', () => {
  it('announces the unread count and opens a list', async () => {
    mockApi([ITEM]);
    render(
      <MemoryRouter>
        <NotificationBell unread={3} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Notifications, 3 unread' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('link', { name: /New adoption request for Finn/ })).toHaveAttribute('href', '/my-listings/abc/requests');
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('shows the empty state', async () => {
    mockApi([]);
    render(
      <MemoryRouter>
        <NotificationBell unread={0} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('All caught up.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('marks an item read when opened', async () => {
    const fetchMock = mockApi([ITEM]);
    render(
      <MemoryRouter>
        <NotificationBell unread={1} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    await userEvent.click(await screen.findByRole('link', { name: /New adoption request/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/notifications/read', expect.objectContaining({ method: 'POST', body: JSON.stringify({ ids: ['1'] }) })),
    );
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  it.each([
    ['2026-11-16T11:59:40Z', 'Just now'],
    ['2026-11-16T11:55:00Z', '5 min ago'],
    ['2026-11-16T09:00:00Z', '3 h ago'],
    ['2026-11-15T10:00:00Z', 'Yesterday'],
    ['2026-11-12T10:00:00Z', '4 days ago'],
  ])('%s → %s', (iso, expected) => expect(relativeTime(iso, now)).toBe(expected));
});
