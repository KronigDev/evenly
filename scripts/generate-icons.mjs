// Generates the Evenly PWA icon set (PNG + SVG) from an inline SVG master.
// Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const BRAND = '#0a7a55';

// "Evenly" mark: two balanced rounded bars (an equals sign) = split evenly.
const mark = (cy1, cy2) => `
    <rect x="146" y="${cy1}" width="220" height="44" rx="22" fill="#ffffff"/>
    <rect x="146" y="${cy2}" width="220" height="44" rx="22" fill="#ffffff"/>`;

const rounded = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="116" fill="${BRAND}"/>${mark(194, 274)}
</svg>`;

// Maskable: full-bleed square (platform applies its own mask), mark in safe zone.
const maskable = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${BRAND}"/>${mark(198, 278)}
</svg>`;

async function png(svg, size, name) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(outDir, name));
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'icon.svg'), rounded, 'utf8');
await Promise.all([
  png(rounded, 192, 'icon-192.png'),
  png(rounded, 512, 'icon-512.png'),
  png(maskable, 512, 'icon-512-maskable.png'),
  png(maskable, 192, 'icon-192-maskable.png'),
  png(rounded, 180, 'apple-touch-icon.png'),
  png(rounded, 32, 'favicon-32.png'),
  png(rounded, 16, 'favicon-16.png'),
]);
// Also expose a top-level favicon.ico-equivalent (PNG) and svg for the browser tab.
await writeFile(join(root, 'public', 'favicon.svg'), rounded, 'utf8');
await png(rounded, 48, '../favicon.png');

console.log('✓ Generated Evenly icons in public/icons/');
