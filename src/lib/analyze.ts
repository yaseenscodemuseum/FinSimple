import type {
  TransactionRow,
  SpendingBreakdownData,
  MonthlyProjectionData,
  SubscriptionHunterData,
  CategoryBreakdown,
  RecurringCharge,
  MonthlyProjection,
} from "./types";

export function analyzeSpendingBreakdown(rows: TransactionRow[]): SpendingBreakdownData {
  const expenses = rows.filter((r) => r.amount < 0);

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const row of expenses) {
    const cat = row.category || "Other";
    const existing = categoryMap.get(cat) || { total: 0, count: 0 };
    existing.total += Math.abs(row.amount);
    existing.count += 1;
    categoryMap.set(cat, existing);
  }

  const total = expenses.reduce((sum, r) => sum + Math.abs(r.amount), 0);

  const categories: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([name, { total: amount, count }]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
      percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      transactionCount: count,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topExpenses = expenses
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 5)
    .map((r) => ({
      description: r.description,
      amount: Math.abs(r.amount),
      date: r.date,
    }));

  return {
    categories,
    total: Math.round(total * 100) / 100,
    topExpenses,
  };
}

export function analyzeMonthlyProjection(
  rows: TransactionRow[],
  currentBalance: number = 0
): MonthlyProjectionData {
  const expenses = rows.filter((r) => r.amount < 0);
  const income = rows.filter((r) => r.amount > 0);

  const dates = rows
    .map((r) => parseTransactionDate(r.date))
    .filter((d): d is Date => d !== null);

  let monthSpan = 1;
  if (dates.length >= 2) {
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    const diffMs = sorted[sorted.length - 1].getTime() - sorted[0].getTime();
    monthSpan = Math.max(1, diffMs / (1000 * 60 * 60 * 24 * 30));
  }

  const totalExpenses = expenses.reduce((sum, r) => sum + Math.abs(r.amount), 0);
  const totalIncome = income.reduce((sum, r) => sum + r.amount, 0);
  const monthlyExpenses = totalExpenses / monthSpan;
  const monthlyIncome = totalIncome / monthSpan;
  const monthlyNet = monthlyIncome - monthlyExpenses;

  const projections: MonthlyProjection[] = [];
  let cumulative = currentBalance;
  let goesNegative = false;
  let negativeMonth: string | null = null;

  const now = new Date();
  for (const offset of [1, 3, 6]) {
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const monthLabel = target.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    cumulative += monthlyNet * (offset === 1 ? 1 : offset === 3 ? 2 : 3);

    projections.push({
      month: monthLabel,
      projected: Math.round(monthlyNet * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
    });

    if (cumulative < 0 && !goesNegative) {
      goesNegative = true;
      negativeMonth = monthLabel;
    }
  }

  return {
    currentMonthlySpend: Math.round(monthlyExpenses * 100) / 100,
    currentBalance,
    projections,
    goesNegative,
    negativeMonth,
  };
}

export function analyzeSubscriptions(rows: TransactionRow[]): SubscriptionHunterData {
  const expenses = rows.filter((r) => r.amount < 0);

  const merchantMap = new Map<
    string,
    { amounts: number[]; dates: Date[]; description: string }
  >();

  for (const row of expenses) {
    const key = normalizeMerchant(row.description);
    const existing = merchantMap.get(key) || { amounts: [], dates: [], description: row.description };
    existing.amounts.push(Math.abs(row.amount));
    const parsed = parseTransactionDate(row.date);
    if (parsed) existing.dates.push(parsed);
    merchantMap.set(key, existing);
  }

  const subscriptions: RecurringCharge[] = [];

  for (const [, data] of merchantMap) {
    if (data.amounts.length < 2) continue;

    const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
    const amountVariance =
      data.amounts.reduce((sum, a) => sum + Math.abs(a - avgAmount), 0) / data.amounts.length;
    const isConsistentAmount = amountVariance / avgAmount < 0.15;

    if (!isConsistentAmount) continue;

    const frequency = detectFrequency(data.dates);
    if (!frequency) continue;

    const annualMultiplier: Record<string, number> = {
      weekly: 52,
      biweekly: 26,
      monthly: 12,
      quarterly: 4,
      yearly: 1,
    };

    const sortedDates = data.dates.sort((a, b) => b.getTime() - a.getTime());

    subscriptions.push({
      merchant: data.description,
      amount: Math.round(avgAmount * 100) / 100,
      frequency,
      annualTotal: Math.round(avgAmount * annualMultiplier[frequency] * 100) / 100,
      lastSeen: sortedDates[0]?.toISOString().split("T")[0] ?? "",
    });
  }

  subscriptions.sort((a, b) => b.annualTotal - a.annualTotal);

  const totalMonthly = subscriptions.reduce((sum, s) => {
    const monthlyMultiplier: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 1 / 3,
      yearly: 1 / 12,
    };
    return sum + s.amount * (monthlyMultiplier[s.frequency] ?? 1);
  }, 0);

  return {
    subscriptions,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
  };
}

function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function detectFrequency(
  dates: Date[]
): "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | null {
  if (dates.length < 2) return null;

  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap >= 3 && avgGap <= 10) return "weekly";
  if (avgGap >= 11 && avgGap <= 18) return "biweekly";
  if (avgGap >= 25 && avgGap <= 40) return "monthly";
  if (avgGap >= 80 && avgGap <= 110) return "quarterly";
  if (avgGap >= 340 && avgGap <= 400) return "yearly";

  return null;
}

function parseTransactionDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (parts) {
    const [, m, d, y] = parts;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(m) - 1, parseInt(d));
  }

  return null;
}
