"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "finsimple-privacy-dismissed";

export function PrivacyNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[90%] max-w-lg -translate-x-1/2
                    rounded-xl bg-[var(--color-surface-alt)] backdrop-blur-xl
                    border border-[var(--color-divider)] shadow-xl p-4
                    animate-fade-in">
      <div className="flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             className="shrink-0 text-[var(--color-accent)] mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div className="flex-1">
          <p className="text-xs text-[var(--color-text-primary)]">
            Your documents are analyzed locally in the browser. Only compact summaries are sent
            to an AI provider for chat and report narration. Nothing is stored on our servers.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs font-medium text-[var(--color-accent)]
                     hover:underline"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
