"use client";

import { useState } from "react";
import type { Report, SpendingBreakdownData, MonthlyProjectionData, SubscriptionHunterData } from "@/lib/types";
import { SpendingPieChart, ProjectionLineChart } from "./ReportChart";
import { formatCurrency } from "@/lib/utils";

interface Props {
  report: Report;
  onRemove: () => void;
}

export function ReportCard({ report, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);

  const iconMap: Record<string, string> = {
    spending_breakdown: "PIE",
    monthly_projection: "LINE",
    subscription_hunter: "SUB",
    custom_advice: "ADV",
  };

  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-divider)] p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                         bg-[var(--color-accent)]/20 text-[var(--color-accent)]
                         text-[10px] font-bold">
          {iconMap[report.type] ?? "?"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
            {report.title}
          </p>
          <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2">
            {report.narration.summary}
          </p>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[var(--color-accent)] hover:underline"
        >
          {expanded ? "Collapse" : "View"}
        </button>
        <button
          onClick={onRemove}
          className="text-[10px] text-[var(--color-text-secondary)] hover:text-red-400"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[var(--color-divider)] pt-3">
          {report.type === "spending_breakdown" && report.computed && (
            <SpendingBreakdownDetail data={report.computed as SpendingBreakdownData} />
          )}
          {report.type === "monthly_projection" && report.computed && (
            <MonthlyProjectionDetail data={report.computed as MonthlyProjectionData} />
          )}
          {report.type === "subscription_hunter" && report.computed && (
            <SubscriptionDetail data={report.computed as SubscriptionHunterData} />
          )}

          {report.narration.insights.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] mb-1">
                Insights
              </p>
              <ul className="space-y-1">
                {report.narration.insights.map((insight, i) => (
                  <li key={i} className="text-xs text-[var(--color-text-primary)] flex gap-1.5">
                    <span className="text-[var(--color-accent)]">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpendingBreakdownDetail({ data }: { data: SpendingBreakdownData }) {
  return (
    <div>
      <SpendingPieChart data={data} />
      <div className="mt-3 space-y-1">
        {data.categories.slice(0, 6).map((cat) => (
          <div key={cat.name} className="flex justify-between text-xs">
            <span className="text-[var(--color-text-primary)]">{cat.name}</span>
            <span className="text-[var(--color-text-secondary)]">
              {formatCurrency(cat.amount)} ({cat.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyProjectionDetail({ data }: { data: MonthlyProjectionData }) {
  return (
    <div>
      <ProjectionLineChart data={data} />
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Monthly spend: {formatCurrency(data.currentMonthlySpend)}
      </p>
      {data.goesNegative && (
        <p className="mt-1 text-xs text-red-400">
          Warning: projected to go negative by {data.negativeMonth}
        </p>
      )}
    </div>
  );
}

function SubscriptionDetail({ data }: { data: SubscriptionHunterData }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Total: {formatCurrency(data.totalMonthly)}/mo · {formatCurrency(data.totalAnnual)}/yr
      </p>
      {data.subscriptions.map((sub, i) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="text-[var(--color-text-primary)] truncate mr-2">{sub.merchant}</span>
          <span className="text-[var(--color-text-secondary)] whitespace-nowrap">
            {formatCurrency(sub.amount)}/{sub.frequency}
          </span>
        </div>
      ))}
    </div>
  );
}
