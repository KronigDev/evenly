import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3001';
const OUT = process.env.OUT ?? '.';

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill('ada@evenly.app');
  await page.locator('#login-password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();

// Login page (light)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-login-light.png` });
  await ctx.close();
}

// Dashboard light + a group page
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await login(page);
  await page.screenshot({ path: `${OUT}/02-dashboard-light.png`, fullPage: false });
  // open a group
  await page.getByText('Berlin Flat').first().click();
  await page.waitForURL(/\/groups\//, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/03-group-light.png`, fullPage: false });
  await ctx.close();
}

// Dashboard dark
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await login(page);
  await page.screenshot({ path: `${OUT}/04-dashboard-dark.png`, fullPage: false });
  await ctx.close();
}

// Mobile dashboard
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await login(page);
  await page.screenshot({ path: `${OUT}/05-dashboard-mobile.png`, fullPage: false });
  await ctx.close();
}

await browser.close();
console.log('screenshots written to', OUT);
