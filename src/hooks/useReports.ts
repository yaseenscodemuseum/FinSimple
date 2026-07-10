"use client";

import { useState, useCallback } from "react";
import type { Report, ReportType, TransactionRow } from "@/lib/types";
import {
  analyzeSpendingBreakdown,
  analyzeMonthlyProjection,
  analyzeSubscriptions,
} from "@/lib/analyze";
import { generateId } from "@/lib/utils";

export function useReports(getAllRows: () => TransactionRow[]) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = useCallback(
    async (type: ReportType, customPrompt?: string) => {
      const rows = getAllRows();
      if (rows.length === 0) return;

      setIsGenerating(true);

      let computed: Report["computed"] = null;
      let title = "";

      switch (type) {
        case "spending_breakdown":
          computed = analyzeSpendingBreakdown(rows);
          title = "Spending Breakdown";
          break;
        case "monthly_projection":
          computed = analyzeMonthlyProjection(rows);
          title = "Monthly Projection";
          break;
        case "subscription_hunter":
          computed = analyzeSubscriptions(rows);
          title = "Subscription Hunter";
          break;
        case "custom_advice":
          computed = analyzeSpendingBreakdown(rows);
          title = "Custom Advice";
          break;
      }

      try {
        const response = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, computed, customPrompt }),
        });

        let narration = { summary: "Report generated.", insights: ["See the data above."] };

        if (response.ok) {
          const data = await response.json();
          if (data.narration) narration = data.narration;
        }

        const report: Report = {
          id: generateId(),
          type,
          title,
          createdAt: Date.now(),
          computed,
          narration,
        };

        setReports((prev) => [report, ...prev]);
      } catch {
        const report: Report = {
          id: generateId(),
          type,
          title,
          createdAt: Date.now(),
          computed,
          narration: {
            summary: "Report generated (AI narration unavailable).",
            insights: ["The numbers above are computed from your data."],
          },
        };
        setReports((prev) => [report, ...prev]);
      } finally {
        setIsGenerating(false);
      }
    },
    [getAllRows]
  );

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { reports, isGenerating, generateReport, removeReport };
}
