// =============================================================================
// Evenly — database seed (plain ESM, run via `node prisma/seed.mjs`)
// -----------------------------------------------------------------------------
// Creates a realistic demo world: five people, three shared groups + one 1:1,
// a spread of expenses across every split method, settlements, a recurring
// rule, activity feed entries and notifications. Idempotent: it no-ops if any
// users already exist. Every expense's payers and splits sum EXACTLY to its
// base-currency total (asserted), so balances are always correct.
//
// Primary demo login: ada@evenly.app / password123
// =============================================================================

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

// Seed exchange rates as units-per-USD (mirrors src/lib/currency.ts SEED_RATES_PER_USD).
const SEED_RATES_PER_USD = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.9,
  JPY: 157,
  CAD: 1.37,
  AUD: 1.51,
  NZD: 1.63,
  CNY: 7.25,
  INR: 83.4,
  SEK: 10.7,
  NOK: 10.8,
  DKK: 6.86,
  PLN: 3.97,
  CZK: 23.2,
  HUF: 363,
  RON: 4.58,
  BGN: 1.8,
  TRY: 32.5,
  ZAR: 18.3,
  BRL: 5.43,
  MXN: 18.4,
  SGD: 1.35,
  HKD: 7.81,
  AED: 3.67,
  THB: 36.7,
  IDR: 16250,
  KRW: 1380,
  PHP: 58.3,
  ILS: 3.74,
};

// -----------------------------------------------------------------------------
// Cent-exact split helpers (provided verbatim by the build contract)
// -----------------------------------------------------------------------------
const splitEqual = (total, n) => {
  const b = Math.floor(total / n);
  const r = total - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
};

const splitByWeights = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.floor((total * w) / sum));
  let rem = total - raw.reduce((a, b) => a + b, 0);
  const fr = weights
    .map((w, i) => ({ i, f: (total * w) / sum - Math.floor((total * w) / sum) }))
    .sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) raw[fr[k % fr.length].i]++;
  return raw;
};

// -----------------------------------------------------------------------------
// Small utilities
// -----------------------------------------------------------------------------
const now = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(now.getTime() - n * DAY_MS);
const daysFromNow = (n) => new Date(now.getTime() + n * DAY_MS);
/** A plausible 64-char sha256 token hash (random; not clickable in the seed). */
const randomTokenHash = () =>
  crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
function assertSum(label, parts, expected) {
  const total = sum(parts);
  if (total !== expected) {
    throw new Error(`Seed integrity: ${label} sums to ${total}, expected ${expected}`);
  }
}

const memberByUser = (group, userId) => {
  const m = group.members.find((x) => x.userId === userId);
  if (!m) throw new Error(`Member for user ${userId} not found in group ${group.name}`);
  return m;
};
const placeholderByEmail = (group, email) => {
  const m = group.members.find((x) => !x.userId && x.email === email);
  if (!m) throw new Error(`Placeholder ${email} not found in group ${group.name}`);
  return m;
};

/**
 * Create an expense with its payers + splits (and optional itemized rows).
 * Validates that payers and splits each sum to `amountBase`, and that itemized
 * rows reconcile to the canonical splits, before touching the database.
 */
async function createExpense(input) {
  const {
    group,
    createdById,
    description,
    category,
    currency,
    amount,
    amountBase,
    exchangeRate,
    date,
    splitMethod,
    payers,
    splits,
    items,
    recurringRuleId,
  } = input;

  assertSum(
    `expense "${description}" payers`,
    payers.map((p) => p.paidAmount),
    amountBase,
  );
  assertSum(
    `expense "${description}" splits`,
    splits.map((s) => s.owedAmount),
    amountBase,
  );

  if (items) {
    assertSum(
      `expense "${description}" items`,
      items.map((it) => it.amount),
      amountBase,
    );
    for (const it of items) {
      assertSum(
        `expense "${description}" item "${it.description}"`,
        it.splits.map((sp) => sp.owedAmount),
        it.amount,
      );
    }
    // Canonical splits must equal the per-member sum of item shares.
    const perMember = new Map();
    for (const it of items) {
      for (const sp of it.splits) {
        perMember.set(sp.memberId, (perMember.get(sp.memberId) ?? 0) + sp.owedAmount);
      }
    }
    for (const s of splits) {
      const fromItems = perMember.get(s.memberId) ?? 0;
      if (fromItems !== s.owedAmount) {
        throw new Error(
          `Seed integrity: itemized "${description}" member ${s.memberId} split ${s.owedAmount} != item-share sum ${fromItems}`,
        );
      }
    }
  }

  return prisma.expense.create({
    data: {
      groupId: group.id,
      description,
      category,
      currency,
      amount,
      exchangeRate,
      amountBase,
      date,
      splitMethod,
      createdById,
      recurringRuleId,
      payers: {
        create: payers.map((p) => ({ memberId: p.memberId, paidAmount: p.paidAmount })),
      },
      splits: {
        create: splits.map((s) => ({
          memberId: s.memberId,
          owedAmount: s.owedAmount,
          shareValue: s.shareValue ?? null,
        })),
      },
      items: items
        ? {
            create: items.map((it) => ({
              description: it.description,
              amount: it.amount,
              splits: {
                create: it.splits.map((sp) => ({
                  memberId: sp.memberId,
                  owedAmount: sp.owedAmount,
                })),
              },
            })),
          }
        : undefined,
    },
  });
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('Seed: data already present, skipping.');
    process.exit(0);
  }

  // --- Exchange rates (USD base) --------------------------------------------
  for (const [quote, rate] of Object.entries(SEED_RATES_PER_USD)) {
    await prisma.exchangeRate.upsert({
      where: { base_quote: { base: 'USD', quote } },
      update: { rate, asOf: now },
      create: { base: 'USD', quote, rate },
    });
  }

  // --- Users ----------------------------------------------------------------
  const passwordHash = await hash('password123', {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const baseUser = { passwordHash, emailVerifiedAt: now };

  const ada = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'ada@evenly.app',
      name: 'Ada Bergström',
      locale: 'en',
      defaultCurrency: 'EUR',
      theme: 'SYSTEM',
    },
  });
  const mateo = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'mateo@evenly.app',
      name: 'Mateo Rossi',
      locale: 'de',
      defaultCurrency: 'EUR',
      theme: 'DARK',
    },
  });
  const lena = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'lena@evenly.app',
      name: 'Lena Hoffmann',
      locale: 'de',
      defaultCurrency: 'EUR',
      theme: 'LIGHT',
    },
  });
  const priya = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'priya@evenly.app',
      name: 'Priya Nair',
      locale: 'en',
      defaultCurrency: 'GBP',
      theme: 'SYSTEM',
    },
  });
  const tom = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'tom@evenly.app',
      name: 'Tom Okafor',
      locale: 'en',
      defaultCurrency: 'USD',
      theme: 'DARK',
    },
  });

  // --- Groups & members -----------------------------------------------------
  const berlin = await prisma.group.create({
    data: {
      type: 'STANDARD',
      name: 'Berlin Flat',
      description: 'Shared flat in Kreuzberg — rent, bills and the weekly shop.',
      emoji: '🏠',
      color: 'violet',
      baseCurrency: 'EUR',
      simplifyDebts: true,
      createdById: ada.id,
      members: {
        create: [
          { userId: ada.id, role: 'ADMIN', status: 'ACTIVE', displayName: 'Ada Bergström' },
          { userId: mateo.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Mateo Rossi' },
          { userId: lena.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Lena Hoffmann' },
          {
            role: 'MEMBER',
            status: 'INVITED',
            displayName: 'Sam',
            email: 'sam@evenly.app',
            invitedById: ada.id,
          },
        ],
      },
    },
    include: { members: true },
  });
  const bAda = memberByUser(berlin, ada.id);
  const bMateo = memberByUser(berlin, mateo.id);
  const bLena = memberByUser(berlin, lena.id);
  const bSam = placeholderByEmail(berlin, 'sam@evenly.app');

  const lisbon = await prisma.group.create({
    data: {
      type: 'STANDARD',
      name: 'Lisbon Trip',
      description: 'Long weekend in Lisbon — flights, stay and lots of pastéis.',
      emoji: '✈️',
      color: 'blue',
      baseCurrency: 'EUR',
      createdById: ada.id,
      members: {
        create: [
          { userId: ada.id, role: 'ADMIN', status: 'ACTIVE', displayName: 'Ada Bergström' },
          { userId: priya.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Priya Nair' },
          { userId: tom.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Tom Okafor' },
          { userId: mateo.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Mateo Rossi' },
        ],
      },
    },
    include: { members: true },
  });
  const lAda = memberByUser(lisbon, ada.id);
  const lPriya = memberByUser(lisbon, priya.id);
  const lTom = memberByUser(lisbon, tom.id);
  const lMateo = memberByUser(lisbon, mateo.id);

  const climbing = await prisma.group.create({
    data: {
      type: 'STANDARD',
      name: 'Climbing Crew',
      description: 'Gym sessions, shared gear and the odd outdoor trip.',
      emoji: '🧗',
      color: 'emerald',
      baseCurrency: 'EUR',
      createdById: ada.id,
      members: {
        create: [
          { userId: ada.id, role: 'ADMIN', status: 'ACTIVE', displayName: 'Ada Bergström' },
          { userId: lena.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Lena Hoffmann' },
          { userId: tom.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Tom Okafor' },
        ],
      },
    },
    include: { members: true },
  });
  const cAda = memberByUser(climbing, ada.id);
  const cLena = memberByUser(climbing, lena.id);
  const cTom = memberByUser(climbing, tom.id);

  const direct = await prisma.group.create({
    data: {
      type: 'DIRECT',
      name: 'Priya Nair',
      color: 'amber',
      baseCurrency: 'EUR',
      createdById: ada.id,
      members: {
        create: [
          { userId: ada.id, role: 'ADMIN', status: 'ACTIVE', displayName: 'Ada Bergström' },
          { userId: priya.id, role: 'MEMBER', status: 'ACTIVE', displayName: 'Priya Nair' },
        ],
      },
    },
    include: { members: true },
  });
  const dAda = memberByUser(direct, ada.id);
  const dPriya = memberByUser(direct, priya.id);

  // --- Pending invite for the placeholder member ----------------------------
  await prisma.invite.create({
    data: {
      groupId: berlin.id,
      memberId: bSam.id,
      email: 'sam@evenly.app',
      tokenHash: randomTokenHash(),
      status: 'PENDING',
      invitedById: ada.id,
      expiresAt: daysFromNow(7),
    },
  });

  // --- Recurring rule: monthly rent in Berlin Flat --------------------------
  const rentDate = new Date('2026-06-01T09:00:00.000Z');
  const rentRule = await prisma.recurringRule.create({
    data: {
      groupId: berlin.id,
      description: 'Rent',
      category: 'rent',
      currency: 'EUR',
      amount: 180000,
      splitMethod: 'EQUAL',
      config: {
        description: 'Rent',
        amount: 180000,
        currency: 'EUR',
        category: 'rent',
        date: rentDate.toISOString(),
        splitMethod: 'EQUAL',
        payers: [{ memberId: bAda.id, amount: 180000 }],
        splits: [{ memberId: bAda.id }, { memberId: bMateo.id }, { memberId: bLena.id }],
      },
      frequency: 'MONTHLY',
      interval: 1,
      nextRunAt: new Date('2026-07-01T09:00:00.000Z'),
      lastRunAt: rentDate,
      active: true,
      createdById: ada.id,
    },
  });

  // ===========================================================================
  // Expenses
  // ===========================================================================

  // --- Berlin Flat (EUR) -----------------------------------------------------
  {
    // 1. Weekly shop — EQUAL across all four (Sam included).
    const members = [bAda, bMateo, bLena, bSam];
    const amounts = splitEqual(8000, members.length); // [2000,2000,2000,2000]
    await createExpense({
      group: berlin,
      createdById: ada.id,
      description: 'Weekly groceries — Rewe',
      category: 'groceries',
      currency: 'EUR',
      amount: 8000,
      amountBase: 8000,
      exchangeRate: 1,
      date: daysAgo(38),
      splitMethod: 'EQUAL',
      payers: [{ memberId: bAda.id, paidAmount: 8000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 2. Internet & electricity — EQUAL across the three residents.
    const members = [bAda, bMateo, bLena];
    const amounts = splitEqual(12000, members.length);
    await createExpense({
      group: berlin,
      createdById: lena.id,
      description: 'Internet & electricity',
      category: 'utilities',
      currency: 'EUR',
      amount: 12000,
      amountBase: 12000,
      exchangeRate: 1,
      date: daysAgo(31),
      splitMethod: 'EQUAL',
      payers: [{ memberId: bLena.id, paidAmount: 12000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 3. Cleaning supplies — SHARES 2/1/1 (Ada uses the most storage).
    const members = [bAda, bMateo, bLena];
    const weights = [2, 1, 1];
    const amounts = splitByWeights(4000, weights); // [2000,1000,1000]
    await createExpense({
      group: berlin,
      createdById: mateo.id,
      description: 'Cleaning supplies & bin bags',
      category: 'household',
      currency: 'EUR',
      amount: 4000,
      amountBase: 4000,
      exchangeRate: 1,
      date: daysAgo(24),
      splitMethod: 'SHARES',
      payers: [{ memberId: bMateo.id, paidAmount: 4000 }],
      splits: members.map((m, i) => ({
        memberId: m.id,
        owedAmount: amounts[i],
        shareValue: weights[i],
      })),
    });
  }

  {
    // 4. Dinner party groceries — EXACT (Sam included, second time).
    const splits = [
      { memberId: bAda.id, owedAmount: 2000, shareValue: 2000 },
      { memberId: bMateo.id, owedAmount: 1500, shareValue: 1500 },
      { memberId: bLena.id, owedAmount: 1550, shareValue: 1550 },
      { memberId: bSam.id, owedAmount: 1500, shareValue: 1500 },
    ];
    await createExpense({
      group: berlin,
      createdById: ada.id,
      description: 'Dinner party groceries',
      category: 'dining',
      currency: 'EUR',
      amount: 6550,
      amountBase: 6550,
      exchangeRate: 1,
      date: daysAgo(16),
      splitMethod: 'EXACT',
      payers: [{ memberId: bAda.id, paidAmount: 6550 }],
      splits,
    });
  }

  {
    // 5. Rent (June) — EQUAL, generated from the recurring rule.
    const members = [bAda, bMateo, bLena];
    const amounts = splitEqual(180000, members.length);
    await createExpense({
      group: berlin,
      createdById: ada.id,
      description: 'Rent — June',
      category: 'rent',
      currency: 'EUR',
      amount: 180000,
      amountBase: 180000,
      exchangeRate: 1,
      date: rentDate,
      splitMethod: 'EQUAL',
      recurringRuleId: rentRule.id,
      payers: [{ memberId: bAda.id, paidAmount: 180000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 6. Odds & ends — EQUAL across the three residents.
    const members = [bAda, bMateo, bLena];
    const amounts = splitEqual(2370, members.length);
    await createExpense({
      group: berlin,
      createdById: mateo.id,
      description: 'Light bulbs & batteries',
      category: 'shopping',
      currency: 'EUR',
      amount: 2370,
      amountBase: 2370,
      exchangeRate: 1,
      date: daysAgo(6),
      splitMethod: 'EQUAL',
      payers: [{ memberId: bMateo.id, paidAmount: 2370 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  // --- Lisbon Trip (EUR) -----------------------------------------------------
  let lisbonFlights;
  {
    // 1. Flights — EQUAL across all four.
    const members = [lAda, lPriya, lTom, lMateo];
    const amounts = splitEqual(48000, members.length);
    lisbonFlights = await createExpense({
      group: lisbon,
      createdById: ada.id,
      description: 'Flights to Lisbon',
      category: 'travel',
      currency: 'EUR',
      amount: 48000,
      amountBase: 48000,
      exchangeRate: 1,
      date: daysAgo(40),
      splitMethod: 'EQUAL',
      payers: [{ memberId: lAda.id, paidAmount: 48000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 2. Airbnb — EQUAL, but split across TWO payers (Ada + Priya fronted it).
    const members = [lAda, lPriya, lTom, lMateo];
    const amounts = splitEqual(96000, members.length);
    await createExpense({
      group: lisbon,
      createdById: ada.id,
      description: 'Airbnb apartment (3 nights)',
      category: 'accommodation',
      currency: 'EUR',
      amount: 96000,
      amountBase: 96000,
      exchangeRate: 1,
      date: daysAgo(40),
      splitMethod: 'EQUAL',
      payers: [
        { memberId: lAda.id, paidAmount: 60000 },
        { memberId: lPriya.id, paidAmount: 36000 },
      ],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 3. Dinner — PERCENTAGE (Ada ordered the most, 40/20/20/20).
    const members = [lAda, lPriya, lTom, lMateo];
    const percents = [40, 20, 20, 20];
    const amounts = splitByWeights(12000, percents); // [4800,2400,2400,2400]
    await createExpense({
      group: lisbon,
      createdById: tom.id,
      description: 'Dinner at Time Out Market',
      category: 'dining',
      currency: 'EUR',
      amount: 12000,
      amountBase: 12000,
      exchangeRate: 1,
      date: daysAgo(33),
      splitMethod: 'PERCENTAGE',
      payers: [{ memberId: lTom.id, paidAmount: 12000 }],
      splits: members.map((m, i) => ({
        memberId: m.id,
        owedAmount: amounts[i],
        shareValue: percents[i],
      })),
    });
  }

  {
    // 4. Rental car — entered in USD; converted to the EUR base.
    // amountBase = round(12000 * 0.92) = 11040; exchangeRate (USD->EUR) = 0.92.
    const members = [lAda, lPriya, lTom, lMateo];
    const amountBase = 11040;
    const amounts = splitEqual(amountBase, members.length); // [2760,2760,2760,2760]
    await createExpense({
      group: lisbon,
      createdById: ada.id,
      description: 'Rental car (paid in USD)',
      category: 'transport',
      currency: 'USD',
      amount: 12000,
      amountBase,
      exchangeRate: 0.92,
      date: daysAgo(32),
      splitMethod: 'EQUAL',
      payers: [{ memberId: lAda.id, paidAmount: amountBase }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 5. Tram & metro tickets — EQUAL.
    const members = [lAda, lPriya, lTom, lMateo];
    const amounts = splitEqual(4000, members.length);
    await createExpense({
      group: lisbon,
      createdById: priya.id,
      description: 'Tram & metro tickets',
      category: 'transport',
      currency: 'EUR',
      amount: 4000,
      amountBase: 4000,
      exchangeRate: 1,
      date: daysAgo(26),
      splitMethod: 'EQUAL',
      payers: [{ memberId: lPriya.id, paidAmount: 4000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 6. Pastéis de Belém & coffee — EQUAL.
    const members = [lAda, lPriya, lTom, lMateo];
    const amounts = splitEqual(2680, members.length);
    await createExpense({
      group: lisbon,
      createdById: mateo.id,
      description: 'Pastéis de Belém & coffee',
      category: 'dining',
      currency: 'EUR',
      amount: 2680,
      amountBase: 2680,
      exchangeRate: 1,
      date: daysAgo(25),
      splitMethod: 'EQUAL',
      payers: [{ memberId: lMateo.id, paidAmount: 2680 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  // --- Climbing Crew (EUR) ---------------------------------------------------
  {
    // 1. Gym day passes — EQUAL.
    const members = [cAda, cLena, cTom];
    const amounts = splitEqual(4500, members.length);
    await createExpense({
      group: climbing,
      createdById: ada.id,
      description: 'Gym day passes',
      category: 'health',
      currency: 'EUR',
      amount: 4500,
      amountBase: 4500,
      exchangeRate: 1,
      date: daysAgo(35),
      splitMethod: 'EQUAL',
      payers: [{ memberId: cAda.id, paidAmount: 4500 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 2. Shared gear — ITEMIZED. Canonical splits = per-member item-share sums.
    //   rope        12000 -> Ada/Lena/Tom 4000 each
    //   quickdraws   9000 -> Ada/Tom      4500 each (Lena opted out)
    //   chalk        2400 -> Ada/Lena/Tom  800 each
    //   totals: Ada 9300, Lena 4800, Tom 9300  (= 23400)
    const items = [
      {
        description: 'Climbing rope (60m)',
        amount: 12000,
        splits: [
          { memberId: cAda.id, owedAmount: 4000 },
          { memberId: cLena.id, owedAmount: 4000 },
          { memberId: cTom.id, owedAmount: 4000 },
        ],
      },
      {
        description: 'Quickdraws set',
        amount: 9000,
        splits: [
          { memberId: cAda.id, owedAmount: 4500 },
          { memberId: cTom.id, owedAmount: 4500 },
        ],
      },
      {
        description: 'Chalk bags ×3',
        amount: 2400,
        splits: [
          { memberId: cAda.id, owedAmount: 800 },
          { memberId: cLena.id, owedAmount: 800 },
          { memberId: cTom.id, owedAmount: 800 },
        ],
      },
    ];
    await createExpense({
      group: climbing,
      createdById: tom.id,
      description: 'Shared gear — rope & quickdraws',
      category: 'shopping',
      currency: 'EUR',
      amount: 23400,
      amountBase: 23400,
      exchangeRate: 1,
      date: daysAgo(28),
      splitMethod: 'ITEMIZED',
      payers: [{ memberId: cTom.id, paidAmount: 23400 }],
      splits: [
        { memberId: cAda.id, owedAmount: 9300 },
        { memberId: cLena.id, owedAmount: 4800 },
        { memberId: cTom.id, owedAmount: 9300 },
      ],
      items,
    });
  }

  {
    // 3. Post-climb beers — EXACT.
    const splits = [
      { memberId: cAda.id, owedAmount: 1200, shareValue: 1200 },
      { memberId: cLena.id, owedAmount: 1000, shareValue: 1000 },
      { memberId: cTom.id, owedAmount: 1100, shareValue: 1100 },
    ];
    await createExpense({
      group: climbing,
      createdById: lena.id,
      description: 'Post-climb beers',
      category: 'drinks',
      currency: 'EUR',
      amount: 3300,
      amountBase: 3300,
      exchangeRate: 1,
      date: daysAgo(20),
      splitMethod: 'EXACT',
      payers: [{ memberId: cLena.id, paidAmount: 3300 }],
      splits,
    });
  }

  let climbingComp;
  {
    // 4. Competition entry — EQUAL.
    const members = [cAda, cLena, cTom];
    const amounts = splitEqual(6000, members.length);
    climbingComp = await createExpense({
      group: climbing,
      createdById: tom.id,
      description: 'Bouldering competition entry',
      category: 'entertainment',
      currency: 'EUR',
      amount: 6000,
      amountBase: 6000,
      exchangeRate: 1,
      date: daysAgo(13),
      splitMethod: 'EQUAL',
      payers: [{ memberId: cTom.id, paidAmount: 6000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  {
    // 5. Snacks — EQUAL.
    const members = [cAda, cLena, cTom];
    const amounts = splitEqual(1530, members.length);
    await createExpense({
      group: climbing,
      createdById: ada.id,
      description: 'Protein bars & snacks',
      category: 'groceries',
      currency: 'EUR',
      amount: 1530,
      amountBase: 1530,
      exchangeRate: 1,
      date: daysAgo(5),
      splitMethod: 'EQUAL',
      payers: [{ memberId: cAda.id, paidAmount: 1530 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  // --- Direct 1:1 (Ada ↔ Priya, EUR) ----------------------------------------
  {
    const members = [dAda, dPriya];
    const amounts = splitEqual(9000, members.length);
    await createExpense({
      group: direct,
      createdById: ada.id,
      description: 'Concert tickets',
      category: 'entertainment',
      currency: 'EUR',
      amount: 9000,
      amountBase: 9000,
      exchangeRate: 1,
      date: daysAgo(21),
      splitMethod: 'EQUAL',
      payers: [{ memberId: dAda.id, paidAmount: 9000 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }
  {
    const members = [dAda, dPriya];
    const amounts = splitEqual(3600, members.length);
    await createExpense({
      group: direct,
      createdById: priya.id,
      description: 'Lunch at Mercado da Ribeira',
      category: 'dining',
      currency: 'EUR',
      amount: 3600,
      amountBase: 3600,
      exchangeRate: 1,
      date: daysAgo(7),
      splitMethod: 'EQUAL',
      payers: [{ memberId: dPriya.id, paidAmount: 3600 }],
      splits: members.map((m, i) => ({ memberId: m.id, owedAmount: amounts[i] })),
    });
  }

  // ===========================================================================
  // Settlements (base minor units)
  // ===========================================================================
  await prisma.settlement.create({
    data: {
      groupId: berlin.id,
      fromMemberId: bMateo.id,
      toMemberId: bAda.id,
      amount: 5000,
      currency: 'EUR',
      date: daysAgo(3),
      note: 'Part of what I owe for the flat',
      createdById: mateo.id,
    },
  });
  await prisma.settlement.create({
    data: {
      groupId: lisbon.id,
      fromMemberId: lTom.id,
      toMemberId: lAda.id,
      amount: 8000,
      currency: 'EUR',
      date: daysAgo(10),
      note: 'Paying you back for the flights',
      createdById: tom.id,
    },
  });

  // ===========================================================================
  // Activity feed
  // ===========================================================================
  await prisma.activity.createMany({
    data: [
      {
        groupId: lisbon.id,
        actorId: ada.id,
        type: 'GROUP_CREATED',
        data: { name: 'Lisbon Trip', emoji: '✈️', type: 'STANDARD' },
        createdAt: daysAgo(41),
      },
      {
        groupId: berlin.id,
        actorId: ada.id,
        type: 'GROUP_CREATED',
        data: { name: 'Berlin Flat', emoji: '🏠', type: 'STANDARD' },
        createdAt: daysAgo(40),
      },
      {
        groupId: berlin.id,
        actorId: ada.id,
        type: 'MEMBER_INVITED',
        data: { email: 'sam@evenly.app', displayName: 'Sam' },
        createdAt: daysAgo(39),
      },
      {
        groupId: lisbon.id,
        actorId: ada.id,
        type: 'EXPENSE_ADDED',
        expenseId: lisbonFlights.id,
        data: { description: 'Flights to Lisbon', amount: 48000, currency: 'EUR' },
        createdAt: daysAgo(40),
      },
      {
        groupId: climbing.id,
        actorId: tom.id,
        type: 'EXPENSE_ADDED',
        expenseId: climbingComp.id,
        data: { description: 'Bouldering competition entry', amount: 6000, currency: 'EUR' },
        createdAt: daysAgo(13),
      },
      {
        groupId: berlin.id,
        actorId: mateo.id,
        type: 'SETTLEMENT_ADDED',
        data: {
          fromMemberId: bMateo.id,
          toMemberId: bAda.id,
          amount: 5000,
          currency: 'EUR',
        },
        createdAt: daysAgo(3),
      },
    ],
  });

  // ===========================================================================
  // Notifications for Ada (unread)
  // ===========================================================================
  await prisma.notification.createMany({
    data: [
      {
        userId: ada.id,
        type: 'EXPENSE_ADDED',
        data: {
          groupId: climbing.id,
          groupName: 'Climbing Crew',
          expenseId: climbingComp.id,
          description: 'Bouldering competition entry',
          amount: 6000,
          currency: 'EUR',
          actorName: 'Tom Okafor',
        },
        createdAt: daysAgo(13),
      },
      {
        userId: ada.id,
        type: 'SETTLEMENT_ADDED',
        data: {
          groupId: berlin.id,
          groupName: 'Berlin Flat',
          amount: 5000,
          currency: 'EUR',
          fromName: 'Mateo Rossi',
        },
        createdAt: daysAgo(3),
      },
      {
        userId: ada.id,
        type: 'MEMBER_JOINED',
        data: { groupId: lisbon.id, groupName: 'Lisbon Trip', memberName: 'Tom Okafor' },
        createdAt: daysAgo(40),
      },
    ],
  });

  // --- Summary --------------------------------------------------------------
  const summary = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
    members: await prisma.groupMember.count(),
    invites: await prisma.invite.count(),
    expenses: await prisma.expense.count(),
    expenseItems: await prisma.expenseItem.count(),
    recurringRules: await prisma.recurringRule.count(),
    settlements: await prisma.settlement.count(),
    activities: await prisma.activity.count(),
    notifications: await prisma.notification.count(),
    exchangeRates: await prisma.exchangeRate.count(),
  };
  console.log('Seed complete:', JSON.stringify(summary, null, 2));
  console.log('Primary demo login: ada@evenly.app / password123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
