import type { Config } from 'tailwindcss';

/**
 * Evenly design system.
 * Colors are CSS variables (RGB channels) so every utility supports the
 * Tailwind alpha modifier (e.g. `bg-brand/10`) and flips cleanly between
 * light and dark via the `.dark` class (driven by next-themes).
 */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: withAlpha('--c-canvas'),
        surface: {
          DEFAULT: withAlpha('--c-surface'),
          2: withAlpha('--c-surface-2'),
          3: withAlpha('--c-surface-3'),
        },
        hairline: withAlpha('--c-border'),
        'hairline-strong': withAlpha('--c-border-strong'),
        ink: {
          DEFAULT: withAlpha('--c-ink'),
          on: withAlpha('--c-on-ink'),
        },
        content: {
          DEFAULT: withAlpha('--c-text'),
          muted: withAlpha('--c-text-muted'),
          subtle: withAlpha('--c-text-subtle'),
        },
        brand: {
          DEFAULT: withAlpha('--c-brand'),
          strong: withAlpha('--c-brand-strong'),
        },
        positive: withAlpha('--c-positive'),
        negative: withAlpha('--c-negative'),
        warning: withAlpha('--c-warning'),
        info: withAlpha('--c-info'),
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '0.5rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--c-shadow) / 0.05), 0 1px 1px rgb(var(--c-shadow) / 0.03)',
        card: '0 1px 2px rgb(var(--c-shadow) / 0.04), 0 12px 32px -16px rgb(var(--c-shadow) / 0.16)',
        pop: '0 4px 12px -2px rgb(var(--c-shadow) / 0.10), 0 16px 48px -12px rgb(var(--c-shadow) / 0.28)',
        focus: '0 0 0 2px rgb(var(--c-surface)), 0 0 0 4px rgb(var(--c-brand) / 0.55)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        eyebrow: '0.18em',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1) both',
        'overlay-in': 'overlay-in 0.2s ease both',
      },
    },
  },
  plugins: [],
};

export default config;
