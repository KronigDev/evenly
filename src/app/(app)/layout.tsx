import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUserHasPassword, getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { serializeUser } from '@/lib/serialize';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect('/login');

  const [fullUser, hasPassword] = await Promise.all([
    prisma.user.findUnique({ where: { id: sessionUser.id } }),
    currentUserHasPassword(),
  ]);
  if (!fullUser) redirect('/login');

  return <AppShell user={serializeUser(fullUser, hasPassword)}>{children}</AppShell>;
}
