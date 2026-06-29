import { Clock } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import { Avatar, type AvatarSize } from './avatar';

export interface MemberLike {
  displayName: string;
  image?: string | null;
  status?: string;
  user?: { name: string; image: string | null } | null;
}

const badgeSizeClass: Record<AvatarSize, string> = {
  xs: 'h-2.5 w-2.5',
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

const badgeIconPx: Record<AvatarSize, number> = { xs: 7, sm: 8, md: 10, lg: 11 };

export interface MemberAvatarProps {
  member: MemberLike;
  size?: AvatarSize;
  className?: string;
}

export function MemberAvatar({ member, size = 'md', className }: MemberAvatarProps) {
  const name = member.user?.name ?? member.displayName;
  const image = member.user?.image ?? member.image ?? null;
  const pending = member.status === 'INVITED';

  return (
    <span className={cn('relative inline-flex', className)}>
      <Avatar
        name={name}
        image={image}
        size={size}
        className={pending ? 'opacity-90 ring-1 ring-warning/45' : undefined}
      />
      {pending ? (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-warning text-white ring-2 ring-canvas',
            badgeSizeClass[size],
          )}
          title="Invitation pending"
        >
          <Clock size={badgeIconPx[size]} weight="bold" aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}
