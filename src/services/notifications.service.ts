import { Notification, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const LIST_DESCRIPTION_TRUNCATE_LENGTH = 200;

/** Presentation-layer relative time — Laravel's Notification model overrides `created_at` with
 * `diffForHumans()`; Node formats this at serialization time rather than in the stored column. */
function relativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return date.toISOString().slice(0, 10);
}

function mapListItem(notification: Notification) {
  const description = notification.description;
  const truncated =
    description && description.length > LIST_DESCRIPTION_TRUNCATE_LENGTH
      ? `${description.slice(0, LIST_DESCRIPTION_TRUNCATE_LENGTH)}…`
      : description;
  return {
    id: notification.id,
    senderId: notification.senderId,
    title: notification.title,
    description: truncated,
    seen: notification.seen,
    createdAt: notification.createdAt,
    createdAtHuman: relativeTime(notification.createdAt),
  };
}

function mapDetail(notification: Notification) {
  return {
    id: notification.id,
    senderId: notification.senderId,
    receiverId: notification.receiverId,
    title: notification.title,
    description: notification.description,
    seen: notification.seen,
    createdAt: notification.createdAt,
    createdAtHuman: relativeTime(notification.createdAt),
  };
}

export const notificationsService = {
  /** Inbox for receiverId = currentUser.id, newest first, paginated (notifications.md). */
  async list(shopId: number, userId: number, params: { page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.NotificationWhereInput = { shopId, receiverId: userId };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.notification.count({ where }),
    ]);
    return {
      items: items.map(mapListItem),
      meta: { page: params.page, limit: params.limit, total },
    };
  },

  async unreadCount(shopId: number, userId: number) {
    const count = await prisma.notification.count({
      where: { shopId, receiverId: userId, seen: false },
    });
    return { unreadCount: count };
  },

  async findOwnedOrThrow(shopId: number, userId: number, id: number): Promise<Notification> {
    const notification = await prisma.notification.findFirst({ where: { id, shopId } });
    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    }
    if (notification.receiverId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'This notification does not belong to you');
    }
    return notification;
  },

  /** Marks seen (idempotent) and returns full detail — GET /notifications/:id. */
  async getAndMarkSeen(shopId: number, userId: number, id: number) {
    const notification = await this.findOwnedOrThrow(shopId, userId, id);
    const updated = notification.seen
      ? notification
      : await prisma.notification.update({ where: { id }, data: { seen: true } });
    return mapDetail(updated);
  },

  /** Lightweight mark-seen with no detail payload (idempotent) — PATCH /notifications/:id/seen. */
  async markSeen(shopId: number, userId: number, id: number) {
    const notification = await this.findOwnedOrThrow(shopId, userId, id);
    if (!notification.seen) {
      await prisma.notification.update({ where: { id }, data: { seen: true } });
    }
    return { message: 'Notification marked as seen' };
  },

  /** No-op success on zero unseen rows (notifications.md edge case). */
  async markAllSeen(shopId: number, userId: number) {
    const result = await prisma.notification.updateMany({
      where: { shopId, receiverId: userId, seen: false },
      data: { seen: true },
    });
    return { message: 'All notifications marked as seen', updated: result.count };
  },

  /** Internal helper for domain flows/seed/tests — not exposed as a public create endpoint
   * (notifications.md: no create/update/delete surface for end users). */
  async createNotification(data: {
    shopId: number;
    receiverId: number;
    senderId?: number | null;
    title?: string | null;
    description?: string | null;
  }): Promise<Notification> {
    return prisma.notification.create({
      data: {
        shopId: data.shopId,
        receiverId: data.receiverId,
        senderId: data.senderId ?? null,
        title: data.title ?? null,
        description: data.description ?? null,
        seen: false,
      },
    });
  },
};
