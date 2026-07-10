"use client";

import { useRef, useState, type DragEvent } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

const ACCEPTED = ".csv,.xlsx,.xls,.pdf,.docx";

export function FileUploadModal({ open, onClose, onFileSelect, isUploading, error }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (!open) return null;

  function handleFile(file: File) {
    onFileSelect(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-overlay" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface-alt)]
                      backdrop-blur-xl border border-[var(--color-divider)]
                      shadow-2xl p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Upload Document
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                      p-10 cursor-pointer transition-colors
                      ${
                        dragging
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                          : "border-[var(--color-input-border)] hover:border-[var(--color-accent)]"
                      }`}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
               className="text-[var(--color-text-secondary)] mb-3">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {isUploading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Processing...</p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-primary)]">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                CSV, Excel, PDF, or DOCX
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
