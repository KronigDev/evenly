import { addDays, addMonths, addWeeks } from 'date-fns';
import type { RecurrenceFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getRateMap } from '@/lib/exchange-rates';
import { createExpense } from '@/lib/expenses';
import { createExpenseSchema } from '@/lib/validation/expense';

function advance(from: Date, frequency: RecurrenceFrequency, interval: number): Date {
  if (frequency === 'DAILY') return addDays(from, interval);
  if (frequency === 'WEEKLY') return addWeeks(from, interval);
  return addMonths(from, interval);
}

/**
 * Generate any due occurrences of a group's recurring rules. Called lazily when
 * a group is loaded, so no external scheduler is required (it is also safe to
 * call from a cron). Caps generation per rule to avoid runaway backfills.
 */
export async function processGroupRecurring(groupId: string): Promise<number> {
  const now = new Date();
  const rules = await prisma.recurringRule.findMany({
    where: { groupId, active: true, nextRunAt: { lte: now } },
  });
  if (rules.length === 0) return 0;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, baseCurrency: true },
  });
  if (!group) return 0;

  const rates = await getRateMap();
  let created = 0;

  for (const rule of rules) {
    let next = rule.nextRunAt;
    let guard = 0;
    while (next <= now && (!rule.endDate || next <= rule.endDate) && guard < 60) {
      const config = { ...(rule.config as Record<string, unknown>) };
      delete config.recurring;
      config.date = next.toISOString();

      const parsed = createExpenseSchema.safeParse(config);
      if (parsed.success) {
        try {
          const expenseId = await createExpense(
            { group, actorUserId: rule.createdById, rates },
            parsed.data,
          );
          await prisma.expense.update({
            where: { id: expenseId },
            data: { recurringRuleId: rule.id },
          });
          created += 1;
        } catch (err) {
          console.error('[recurring] generation failed:', err);
        }
      }
      next = advance(next, rule.frequency, rule.interval);
      guard += 1;
    }

    const stillActive = rule.endDate ? next <= rule.endDate : true;
    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextRunAt: next, lastRunAt: now, active: stillActive },
    });
  }

  return created;
}
