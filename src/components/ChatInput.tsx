"use client";

import { useState, useRef, type KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  onUploadClick: () => void;
  disabled: boolean;
}

export function ChatInput({ onSend, onUploadClick, disabled }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-[var(--color-glass-border)] p-4 glass">
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <button
          onClick={onUploadClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                     bg-[var(--color-input-bg)] border border-[var(--color-input-border)]
                     text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                     transition-colors"
          aria-label="Upload file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div className="flex flex-1 items-end rounded-xl bg-[var(--color-input-bg)]
                        border border-[var(--color-input-border)]">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-4 py-2.5 text-sm
                       text-[var(--color-text-primary)]
                       placeholder:text-[var(--color-text-secondary)]
                       focus:outline-none max-h-32"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="mr-2 mb-1 flex h-8 w-8 items-center justify-center rounded-lg
                       text-[var(--color-text-secondary)]
                       hover:text-[var(--color-accent)] transition-colors
                       disabled:opacity-40"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
