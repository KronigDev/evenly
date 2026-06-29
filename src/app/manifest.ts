import type { MetadataRoute } from 'next';

/**
 * Web App Manifest, served at `/manifest.webmanifest`.
 * Icons live in `public/icons/*` and are referenced from the web root.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Evenly — Split expenses, fairly',
    short_name: 'Evenly',
    description:
      'Split expenses with friends, flatmates and travel groups. Track who owes what, settle up fairly, and keep every balance to the cent.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#0a7a55',
    orientation: 'portrait',
    lang: 'en',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Add expense',
        short_name: 'Add expense',
        description: 'Quickly record a new shared expense.',
        url: '/expenses/new',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Groups',
        short_name: 'Groups',
        description: 'Jump to your groups and balances.',
        url: '/groups',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
