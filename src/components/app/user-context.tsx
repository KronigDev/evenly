'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserDTO } from '@/lib/api/types';

/**
 * The value returned by {@link useUser}. It spreads the current user's fields
 * (so `useUser().name` works) and also exposes them under `user` (so
 * `const { user } = useUser()` works), plus `setUser` for optimistic updates.
 */
export type UserContextValue = UserDTO & {
  user: UserDTO;
  setUser: (user: UserDTO) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export interface UserProviderProps {
  user: UserDTO;
  children: ReactNode;
}

/**
 * Holds the authenticated user for the whole app shell. Seeded from the server
 * (`AppShell`) and re-synced whenever the server passes a fresh user (after a
 * `router.refresh()`), while still allowing optimistic client updates.
 */
export function UserProvider({ user, children }: UserProviderProps) {
  const [current, setCurrent] = useState<UserDTO>(user);

  // Re-sync when the server supplies an updated user object.
  useEffect(() => {
    setCurrent(user);
  }, [user]);

  const value = useMemo<UserContextValue>(
    () => ({ ...current, user: current, setUser: setCurrent }),
    [current],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** Access the current user. Throws if used outside an `<UserProvider>`. */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a <UserProvider>.');
  return ctx;
}
