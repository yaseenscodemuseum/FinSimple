"use client";

import { useState } from "react";
import type { ReportType } from "@/lib/types";

interface Props {
  onGenerate: (type: ReportType, customPrompt?: string) => void;
  disabled: boolean;
  hasDocuments: boolean;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "spending_breakdown", label: "Spending Breakdown", description: "See where your money goes" },
  { value: "monthly_projection", label: "Monthly Projection", description: "Project future balances" },
  { value: "subscription_hunter", label: "Subscription Hunter", description: "Find recurring charges" },
  { value: "custom_advice", label: "Custom Advice", description: "Ask a specific question" },
];

export function ReportGenerator({ onGenerate, disabled, hasDocuments }: Props) {
  const [selectedType, setSelectedType] = useState<ReportType>("spending_breakdown");
  const [customPrompt, setCustomPrompt] = useState("");

  if (!hasDocuments) return null;

  function handleGenerate() {
    onGenerate(selectedType, selectedType === "custom_advice" ? customPrompt : undefined);
  }

  return (
    <div className="mt-4 border-t border-[var(--color-divider)] pt-4">
      <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] mb-2">
        Generate Report
      </p>
      <div className="space-y-1.5">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.value}
            onClick={() => setSelectedType(rt.value)}
            className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors
              ${selectedType === rt.value
                ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
          >
            <span className="font-medium">{rt.label}</span>
            <span className="block text-[10px] opacity-70">{rt.description}</span>
          </button>
        ))}
      </div>
      {selectedType === "custom_advice" && (
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="What would you like advice on?"
          className="mt-2 w-full rounded-lg bg-[var(--color-input-bg)] border border-[var(--color-input-border)]
                     px-3 py-2 text-xs text-[var(--color-text-primary)]
                     placeholder:text-[var(--color-text-secondary)] focus:outline-none resize-none"
          rows={2}
        />
      )}
      <button
        onClick={handleGenerate}
        disabled={disabled || (selectedType === "custom_advice" && !customPrompt.trim())}
        className="mt-2 w-full rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs
                   font-medium text-white hover:opacity-90 transition-opacity
                   disabled:opacity-40"
      >
        {disabled ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}
