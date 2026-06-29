import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, ok } from '@/lib/http';
import { serializeNotification } from '@/lib/serialize';

export const GET = apiHandler(async () => {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return ok({
    notifications: notifications.map(serializeNotification),
    unreadCount,
  });
});
