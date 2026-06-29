/**
 * Expense categories. Icons reference lucide-react names (resolved in the UI
 * via components/category-icon.tsx) and labels are resolved via i18n keys
 * `categories.<key>`.
 */

export interface CategoryMeta {
  key: string;
  /** lucide-react icon name */
  icon: string;
  /** accent token key (see design tokens) */
  color: string;
}

// `icon` references a Phosphor icon component name (see components/category-icon.tsx).
export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { key: 'general', icon: 'Receipt', color: 'slate' },
  { key: 'groceries', icon: 'ShoppingCart', color: 'green' },
  { key: 'dining', icon: 'ForkKnife', color: 'orange' },
  { key: 'transport', icon: 'Car', color: 'blue' },
  { key: 'travel', icon: 'Airplane', color: 'sky' },
  { key: 'accommodation', icon: 'Bed', color: 'violet' },
  { key: 'utilities', icon: 'Lightbulb', color: 'amber' },
  { key: 'rent', icon: 'House', color: 'rose' },
  { key: 'entertainment', icon: 'FilmSlate', color: 'fuchsia' },
  { key: 'shopping', icon: 'ShoppingBag', color: 'pink' },
  { key: 'health', icon: 'Heartbeat', color: 'red' },
  { key: 'gifts', icon: 'Gift', color: 'emerald' },
  { key: 'household', icon: 'Couch', color: 'teal' },
  { key: 'education', icon: 'GraduationCap', color: 'indigo' },
  { key: 'drinks', icon: 'BeerStein', color: 'yellow' },
  { key: 'other', icon: 'DotsThreeOutline', color: 'zinc' },
];

export const CATEGORY_KEYS = EXPENSE_CATEGORIES.map((c) => c.key);

export function categoryMeta(key: string): CategoryMeta {
  return EXPENSE_CATEGORIES.find((c) => c.key === key) ?? EXPENSE_CATEGORIES[0]!;
}

export function isValidCategory(key: string): boolean {
  return CATEGORY_KEYS.includes(key);
}
