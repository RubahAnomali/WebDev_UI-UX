import { http } from '../api/client';
import { refreshCounts } from '../me/useCounts';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unread: number;
}

export const notificationsService = {
  list: (signal?: AbortSignal) => http.get<NotificationList>('/api/notifications', signal),
  async markRead(ids: string[]) {
    const res = await http.post<{ updated: number }>('/api/notifications/read', { ids });
    refreshCounts();
    return res;
  },
  async markAllRead() {
    const res = await http.post<{ updated: number }>('/api/notifications/read', { all: true });
    refreshCounts();
    return res;
  },
};
