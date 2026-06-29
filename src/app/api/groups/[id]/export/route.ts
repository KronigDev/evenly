import { format } from 'date-fns';
import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { z } from 'zod';
import { requireGroupMembership } from '@/lib/auth/authz';
import { prisma } from '@/lib/db';
import { apiHandler, parseQuery } from '@/lib/http';
import { formatMoney } from '@/lib/money';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const querySchema = z.object({
  format: z.enum(['csv', 'pdf']).default('csv'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

interface ExpenseRow {
  date: Date;
  description: string;
  category: string;
  currency: string;
  amount: number;
  amountBase: number;
  payers: { memberId: string; paidAmount: number }[];
  splits: { memberId: string; owedAmount: number }[];
}

interface SettlementRow {
  date: Date;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  note: string | null;
}

const DATE_FMT = 'yyyy-MM-dd';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'group'
  );
}

function rangeLabel(from: Date | undefined, to: Date | undefined): string {
  if (from && to) return `${format(from, DATE_FMT)} – ${format(to, DATE_FMT)}`;
  if (from) return `From ${format(from, DATE_FMT)}`;
  if (to) return `Until ${format(to, DATE_FMT)}`;
  return 'All time';
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(cells: string[]): string {
  return cells.map(csvField).join(',');
}

function buildCsv(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  baseCurrency: string,
  locale: string,
  nameOf: (id: string) => string,
): string {
  const lines: string[] = [];
  lines.push(
    csvLine([
      'Date',
      'Description',
      'Category',
      'Currency',
      'Amount (entry)',
      'Amount (base)',
      'Paid by',
      'Split',
    ]),
  );
  for (const e of expenses) {
    lines.push(
      csvLine([
        format(e.date, DATE_FMT),
        e.description,
        e.category,
        e.currency,
        formatMoney(e.amount, e.currency, locale),
        formatMoney(e.amountBase, baseCurrency, locale),
        e.payers
          .map((p) => `${nameOf(p.memberId)} (${formatMoney(p.paidAmount, baseCurrency, locale)})`)
          .join('; '),
        e.splits
          .map((s) => `${nameOf(s.memberId)}: ${formatMoney(s.owedAmount, baseCurrency, locale)}`)
          .join('; '),
      ]),
    );
  }

  lines.push('');
  lines.push(csvLine(['Settlements']));
  lines.push(csvLine(['Date', 'From', 'To', 'Amount', 'Note']));
  for (const s of settlements) {
    lines.push(
      csvLine([
        format(s.date, DATE_FMT),
        nameOf(s.fromMemberId),
        nameOf(s.toMemberId),
        formatMoney(s.amount, s.currency, locale),
        s.note ?? '',
      ]),
    );
  }

  // Prepend a BOM so spreadsheet apps detect UTF-8 (currency symbols etc.).
  return `﻿${lines.join('\r\n')}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

interface Column {
  x: number;
  width: number;
}

interface Cell {
  text: string;
  column: Column;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
}

const EXPENSE_COLUMNS: Record<'date' | 'description' | 'category' | 'amount' | 'paidBy', Column> = {
  date: { x: 40, width: 56 },
  description: { x: 100, width: 158 },
  category: { x: 262, width: 62 },
  amount: { x: 328, width: 70 },
  paidBy: { x: 402, width: 153 },
};

const SETTLEMENT_COLUMNS: Record<'date' | 'parties' | 'amount' | 'note', Column> = {
  date: { x: 40, width: 56 },
  parties: { x: 100, width: 200 },
  amount: { x: 304, width: 90 },
  note: { x: 398, width: 157 },
};

/** Replace characters Helvetica's WinAnsi encoding cannot represent. */
function pdfSafe(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += ch;
    else if ('€‘’“”–—…•™'.includes(ch)) out += ch;
    else out += '?';
  }
  return out;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const safe = pdfSafe(text).replace(/\s+/g, ' ').trim();
  if (safe === '' || font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let str = safe;
  while (str.length > 0 && font.widthOfTextAtSize(`${str}…`, size) > maxWidth) {
    str = str.slice(0, -1);
  }
  return str.length > 0 ? `${str}…` : '';
}

async function buildPdf(
  groupName: string,
  baseCurrency: string,
  locale: string,
  label: string,
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  nameOf: (id: string) => string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 40;
  const bottom = margin;
  const contentWidth = pageW - margin * 2;
  const ink = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.45, 0.45, 0.45);

  let page: PDFPage = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;
  let repeatHeader: (() => void) | null = null;

  const newPage = () => {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - margin;
    if (repeatHeader) repeatHeader();
  };

  const drawRow = (cells: Cell[], height: number) => {
    if (y - height < bottom) newPage();
    const baseline = y - height + 4;
    for (const c of cells) {
      const f = c.font ?? font;
      page.drawText(truncate(c.text, f, 9, c.column.width), {
        x: c.column.x,
        y: baseline,
        size: 9,
        font: f,
        color: c.color ?? ink,
      });
    }
    y -= height;
  };

  const drawText = (text: string, size: number, f: PDFFont, color = ink) => {
    const height = size + 6;
    if (y - height < bottom) newPage();
    page.drawText(truncate(text, f, size, contentWidth), {
      x: margin,
      y: y - size,
      size,
      font: f,
      color,
    });
    y -= height;
  };

  // Title block
  drawText(`Evenly — ${groupName}`, 18, bold);
  drawText(`${label} · Base currency ${baseCurrency}`, 10, font, muted);
  drawText(`Generated ${format(new Date(), DATE_FMT)}`, 9, font, muted);
  y -= 8;

  // Expenses
  drawText('Expenses', 13, bold);
  const expenseHeader = () =>
    drawRow(
      [
        { text: 'Date', column: EXPENSE_COLUMNS.date, font: bold, color: muted },
        { text: 'Description', column: EXPENSE_COLUMNS.description, font: bold, color: muted },
        { text: 'Category', column: EXPENSE_COLUMNS.category, font: bold, color: muted },
        { text: 'Amount', column: EXPENSE_COLUMNS.amount, font: bold, color: muted },
        { text: 'Paid by', column: EXPENSE_COLUMNS.paidBy, font: bold, color: muted },
      ],
      16,
    );
  repeatHeader = expenseHeader;
  expenseHeader();

  let totalBase = 0;
  if (expenses.length === 0) {
    drawRow(
      [
        {
          text: 'No expenses in this range.',
          column: { x: 40, width: contentWidth },
          color: muted,
        },
      ],
      15,
    );
  }
  for (const e of expenses) {
    totalBase += e.amountBase;
    drawRow(
      [
        { text: format(e.date, DATE_FMT), column: EXPENSE_COLUMNS.date },
        { text: e.description, column: EXPENSE_COLUMNS.description },
        { text: e.category, column: EXPENSE_COLUMNS.category },
        { text: formatMoney(e.amountBase, baseCurrency, locale), column: EXPENSE_COLUMNS.amount },
        {
          text: e.payers.map((p) => nameOf(p.memberId)).join(', '),
          column: EXPENSE_COLUMNS.paidBy,
        },
      ],
      15,
    );
  }
  repeatHeader = null;
  y -= 4;
  drawText(`Total expenses: ${formatMoney(totalBase, baseCurrency, locale)}`, 11, bold);

  // Settlements
  y -= 10;
  drawText('Settlements', 13, bold);
  const settlementHeader = () =>
    drawRow(
      [
        { text: 'Date', column: SETTLEMENT_COLUMNS.date, font: bold, color: muted },
        { text: 'From / To', column: SETTLEMENT_COLUMNS.parties, font: bold, color: muted },
        { text: 'Amount', column: SETTLEMENT_COLUMNS.amount, font: bold, color: muted },
        { text: 'Note', column: SETTLEMENT_COLUMNS.note, font: bold, color: muted },
      ],
      16,
    );
  repeatHeader = settlementHeader;
  settlementHeader();

  if (settlements.length === 0) {
    drawRow(
      [
        {
          text: 'No settlements in this range.',
          column: { x: 40, width: contentWidth },
          color: muted,
        },
      ],
      15,
    );
  }
  for (const s of settlements) {
    drawRow(
      [
        { text: format(s.date, DATE_FMT), column: SETTLEMENT_COLUMNS.date },
        {
          text: `${nameOf(s.fromMemberId)} -> ${nameOf(s.toMemberId)}`,
          column: SETTLEMENT_COLUMNS.parties,
        },
        { text: formatMoney(s.amount, s.currency, locale), column: SETTLEMENT_COLUMNS.amount },
        { text: s.note ?? '', column: SETTLEMENT_COLUMNS.note },
      ],
      15,
    );
  }
  repeatHeader = null;

  return pdf.save();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  const { user, group } = await requireGroupMembership(id);

  const query = parseQuery(new URL(req.url).searchParams, querySchema);

  const dateRange =
    query.from || query.to
      ? { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) }
      : null;

  const [expenses, settlements, members] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: id, deletedAt: null, ...(dateRange ? { date: dateRange } : {}) },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        date: true,
        description: true,
        category: true,
        currency: true,
        amount: true,
        amountBase: true,
        payers: { select: { memberId: true, paidAmount: true } },
        splits: { select: { memberId: true, owedAmount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId: id, ...(dateRange ? { date: dateRange } : {}) },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        date: true,
        fromMemberId: true,
        toMemberId: true,
        amount: true,
        currency: true,
        note: true,
      },
    }),
    prisma.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const names = new Map<string, string>(members.map((m) => [m.id, m.user?.name ?? m.displayName]));
  const nameOf = (memberId: string): string => names.get(memberId) ?? 'Unknown';

  const locale = user.locale;
  const baseCurrency = group.baseCurrency;
  const fileBase = `evenly-${slugify(group.name)}-${format(new Date(), DATE_FMT)}`;

  if (query.format === 'pdf') {
    const bytes = await buildPdf(
      group.name,
      baseCurrency,
      locale,
      rangeLabel(query.from, query.to),
      expenses,
      settlements,
      nameOf,
    );
    const body = new Uint8Array(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(body.length),
        'Content-Disposition': `attachment; filename="${fileBase}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const csv = buildCsv(expenses, settlements, baseCurrency, locale, nameOf);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
