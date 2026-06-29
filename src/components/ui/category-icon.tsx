import {
  Airplane,
  Bed,
  BeerStein,
  Car,
  Couch,
  DotsThreeOutline,
  FilmSlate,
  ForkKnife,
  Gift,
  GraduationCap,
  Heartbeat,
  House,
  Lightbulb,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  type Icon,
} from '@phosphor-icons/react';
import { categoryMeta } from '@/lib/categories';
import { cn } from '@/lib/utils/cn';

/** Maps every `icon` name used in lib/categories.ts to its Phosphor component. */
const ICON_MAP: Record<string, Icon> = {
  Receipt,
  ShoppingCart,
  ForkKnife,
  Car,
  Airplane,
  Bed,
  Lightbulb,
  House,
  FilmSlate,
  ShoppingBag,
  Heartbeat,
  Gift,
  Couch,
  GraduationCap,
  BeerStein,
  DotsThreeOutline,
};

/** Tile + icon tint per category `color`, tuned for light and dark. */
const COLOR_MAP: Record<string, string> = {
  slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
  green: 'bg-green-500/12 text-green-600 dark:text-green-400',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  fuchsia: 'bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400',
  pink: 'bg-pink-500/12 text-pink-600 dark:text-pink-400',
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  teal: 'bg-teal-500/12 text-teal-600 dark:text-teal-400',
  indigo: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
  yellow: 'bg-yellow-500/12 text-yellow-700 dark:text-yellow-400',
  zinc: 'bg-zinc-500/12 text-zinc-600 dark:text-zinc-300',
};

const FALLBACK_COLOR = 'bg-slate-500/12 text-slate-600 dark:text-slate-300';

export type CategoryIconSize = 'sm' | 'md' | 'lg';

const tileSizeClass: Record<CategoryIconSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
};

const iconPx: Record<CategoryIconSize, number> = { sm: 16, md: 20, lg: 24 };

export interface CategoryIconProps {
  category: string;
  size?: CategoryIconSize;
  className?: string;
}

export function CategoryIcon({ category, size = 'md', className }: CategoryIconProps) {
  const meta = categoryMeta(category);
  const IconComponent = ICON_MAP[meta.icon] ?? Receipt;
  const colorClass = COLOR_MAP[meta.color] ?? FALLBACK_COLOR;

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center',
        tileSizeClass[size],
        colorClass,
        className,
      )}
      aria-hidden="true"
    >
      <IconComponent size={iconPx[size]} />
    </span>
  );
}
