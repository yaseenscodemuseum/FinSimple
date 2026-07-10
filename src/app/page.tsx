"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChatArea } from "@/components/ChatArea";
import { ChatInput } from "@/components/ChatInput";
import { FileUploadModal } from "@/components/FileUploadModal";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { ReportCard } from "@/components/ReportCard";
import { ReportGenerator } from "@/components/ReportGenerator";
import { useChat } from "@/hooks/useChat";
import { useDocuments } from "@/hooks/useDocuments";
import { useReports } from "@/hooks/useReports";
import { formatFileSize } from "@/lib/utils";
import type { UploadedDocument, Report, ReportType, UserProfile } from "@/lib/types";

function loadProfile(): UserProfile {
  const empty: UserProfile = { name: "", age: "", profession: "", bankBalance: "", income: "", addedContext: "" };
  if (typeof window === "undefined") return empty;
  try {
    const saved = localStorage.getItem("finsimple-profile");
    if (saved) return { ...empty, ...JSON.parse(saved) };
  } catch {}
  return empty;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(loadProfile);

  const {
    documents,
    isUploading,
    uploadError,
    addDocument,
    removeDocument,
    downloadDocument,
    getDocumentContext,
    getAllRows,
    clearUploadError,
  } = useDocuments();

  const { messages, isLoading, error, sendMessage } = useChat(getDocumentContext, userProfile);
  const { reports, isGenerating, generateReport, removeReport } = useReports(getAllRows);

  async function handleFileSelect(file: File) {
    await addDocument(file);
    setUploadModalOpen(false);
  }

  function handleGenerateReport(type: ReportType, customPrompt?: string) {
    generateReport(type, customPrompt);
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-glass-border)] glass">
        <div className="w-8" />
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          FinSimple
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sm font-medium text-[var(--color-text-secondary)]
                       hover:text-[var(--color-text-primary)] transition-colors
                       md:hidden"
          >
            Context
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <ChatArea messages={messages} isLoading={isLoading} />
          </div>
          {error && (
            <div className="mx-auto max-w-3xl px-4 pb-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <ChatInput
            onSend={sendMessage}
            onUploadClick={() => {
              clearUploadError();
              setUploadModalOpen(true);
            }}
            disabled={isLoading}
          />
        </div>

        {/* Context sidebar — desktop */}
        <aside className="hidden w-72 shrink-0 border-l border-[var(--color-glass-border)]
                          glass-heavy md:block overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Context
            </h2>
            <SidebarTabs
              documents={documents}
              reports={reports}
              onRemoveDoc={removeDocument}
              onDownloadDoc={downloadDocument}
              onRemoveReport={removeReport}
              onGenerateReport={handleGenerateReport}
              isGenerating={isGenerating}
              userProfile={userProfile}
              onSaveProfile={(p) => { setUserProfile(p); localStorage.setItem("finsimple-profile", JSON.stringify(p)); }}
            />
          </div>
        </aside>

        {/* Context sidebar — mobile slide-out */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40 animate-fade-overlay"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute right-0 top-0 h-full w-72
                              glass-heavy shadow-xl
                              border-l border-[var(--color-glass-border)]
                              overflow-y-auto animate-slide-in-right">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Context
                  </h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <SidebarTabs
                  documents={documents}
                  reports={reports}
                  onRemoveDoc={removeDocument}
                  onDownloadDoc={downloadDocument}
                  onRemoveReport={removeReport}
                  onGenerateReport={handleGenerateReport}
                  isGenerating={isGenerating}
                  userProfile={userProfile}
                  onSaveProfile={(p) => { setUserProfile(p); localStorage.setItem("finsimple-profile", JSON.stringify(p)); }}
                />
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <PrivacyNotice />

      {/* Upload modal */}
      <FileUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onFileSelect={handleFileSelect}
        isUploading={isUploading}
        error={uploadError}
      />
    </div>
  );
}

/* ---------- Sidebar ---------- */

function SidebarTabs({
  documents,
  reports,
  onRemoveDoc,
  onDownloadDoc,
  onRemoveReport,
  onGenerateReport,
  isGenerating,
  userProfile,
  onSaveProfile,
}: {
  documents: UploadedDocument[];
  reports: Report[];
  onRemoveDoc: (id: string) => void;
  onDownloadDoc: (doc: UploadedDocument) => void;
  onRemoveReport: (id: string) => void;
  onGenerateReport: (type: ReportType, customPrompt?: string) => void;
  isGenerating: boolean;
  userProfile: UserProfile;
  onSaveProfile: (p: UserProfile) => void;
}) {
  const [tab, setTab] = useState<"user" | "documents" | "reports">("user");
  const [draft, setDraft] = useState<UserProfile>(userProfile);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSaveProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabClass = (t: string) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      tab === t
        ? "bg-[var(--color-accent)]/80 text-white backdrop-blur-sm"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
    }`;

  return (
    <>
      <div className="mt-4 flex gap-1.5 flex-wrap">
        <button onClick={() => setTab("user")} className={tabClass("user")}>
          User
        </button>
        <button onClick={() => setTab("documents")} className={tabClass("documents")}>
          Docs{documents.length > 0 ? ` (${documents.length})` : ""}
        </button>
        <button onClick={() => setTab("reports")} className={tabClass("reports")}>
          Reports{reports.length > 0 ? ` (${reports.length})` : ""}
        </button>
      </div>

      <div className="mt-4">
        {tab === "user" && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="What should I call you?"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Age</label>
              <input
                type="text"
                value={draft.age}
                onChange={(e) => setDraft({ ...draft, age: e.target.value })}
                placeholder="e.g. 22"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Profession</label>
              <input
                type="text"
                value={draft.profession}
                onChange={(e) => setDraft({ ...draft, profession: e.target.value })}
                placeholder="e.g. Software Engineer"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Bank balance</label>
              <input
                type="text"
                value={draft.bankBalance}
                onChange={(e) => setDraft({ ...draft, bankBalance: e.target.value })}
                placeholder="e.g. ₹25,000"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Pocket money / Salary</label>
              <input
                type="text"
                value={draft.income}
                onChange={(e) => setDraft({ ...draft, income: e.target.value })}
                placeholder="e.g. ₹10,000/month"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Added context</label>
              <textarea
                value={draft.addedContext}
                onChange={(e) => setDraft({ ...draft, addedContext: e.target.value })}
                placeholder="Anything else? Goals, financial situation, etc."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-xs bg-[var(--color-input-bg)]
                           border border-[var(--color-input-border)] backdrop-blur-sm
                           text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50
                           focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
              />
            </div>
            <button
              onClick={handleSave}
              className="w-full rounded-lg py-2 text-xs font-medium
                         bg-[var(--color-accent)]/80 text-white backdrop-blur-sm
                         hover:bg-[var(--color-accent)] transition-colors"
            >
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
        )}
        {tab === "documents" && (
          <>
            {documents.length === 0 ? (
              <p className="text-center text-xs text-[var(--color-text-secondary)] opacity-70 mt-6">
                No documents yet
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onRemove={() => onRemoveDoc(doc.id)}
                    onDownload={() => onDownloadDoc(doc)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {tab === "reports" && (
          <>
            {reports.length === 0 && documents.length === 0 && (
              <p className="text-center text-xs text-[var(--color-text-secondary)] opacity-70 mt-6">
                Upload documents to generate reports
              </p>
            )}
            {reports.length === 0 && documents.length > 0 && (
              <p className="text-center text-xs text-[var(--color-text-secondary)] opacity-70 mt-6">
                No reports yet, generate one below
              </p>
            )}
            <div className="space-y-2">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onRemove={() => onRemoveReport(report.id)}
                />
              ))}
            </div>
            <ReportGenerator
              onGenerate={onGenerateReport}
              disabled={isGenerating}
              hasDocuments={documents.length > 0}
            />
          </>
        )}
      </div>
    </>
  );
}

function DocumentCard({
  doc,
  onRemove,
  onDownload,
}: {
  doc: UploadedDocument;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const iconMap: Record<string, string> = {
    csv: "CSV",
    xlsx: "XLS",
    pdf: "PDF",
    docx: "DOC",
  };

  return (
    <div className="rounded-xl glass p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                         bg-[var(--color-accent)]/20 text-[var(--color-accent)]
                         text-[10px] font-bold">
          {iconMap[doc.type] ?? "?"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
            {doc.filename}
          </p>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {formatFileSize(doc.size)} · {doc.summary.totalTransactions} rows
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onDownload}
          className="text-[10px] text-[var(--color-accent)] hover:underline"
        >
          Download
        </button>
        <button
          onClick={onRemove}
          className="text-[10px] text-[var(--color-text-secondary)] hover:text-red-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
