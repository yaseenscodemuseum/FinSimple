export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface TransactionRow {
  date: string;
  description: string;
  amount: number;
  category?: string;
}

export interface DocumentSummary {
  totalTransactions: number;
  totalAmount: number;
  dateRange: { start: string; end: string } | null;
  topCategories: { name: string; amount: number }[];
  sampleRows: string[];
  currency?: string;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  size: number;
  type: "csv" | "xlsx" | "pdf" | "docx";
  uploadedAt: number;
  file: File;
  rows: TransactionRow[];
  rawText: string;
  summary: DocumentSummary;
}

export type ReportType =
  | "spending_breakdown"
  | "monthly_projection"
  | "subscription_hunter"
  | "custom_advice";

export interface CategoryBreakdown {
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface RecurringCharge {
  merchant: string;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  annualTotal: number;
  lastSeen: string;
}

export interface MonthlyProjection {
  month: string;
  projected: number;
  cumulative: number;
}

export interface SpendingBreakdownData {
  categories: CategoryBreakdown[];
  total: number;
  topExpenses: { description: string; amount: number; date: string }[];
}

export interface MonthlyProjectionData {
  currentMonthlySpend: number;
  currentBalance: number;
  projections: MonthlyProjection[];
  goesNegative: boolean;
  negativeMonth: string | null;
}

export interface SubscriptionHunterData {
  subscriptions: RecurringCharge[];
  totalMonthly: number;
  totalAnnual: number;
}

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  createdAt: number;
  computed: SpendingBreakdownData | MonthlyProjectionData | SubscriptionHunterData | null;
  narration: {
    summary: string;
    insights: string[];
  };
}

export interface DocumentContext {
  filename: string;
  summary: string;
  sampleRows: string[];
}

export interface UserProfile {
  name: string;
  age: string;
  profession: string;
  bankBalance: string;
  income: string;
  addedContext: string;
}
