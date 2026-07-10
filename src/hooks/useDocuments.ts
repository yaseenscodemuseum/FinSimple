"use client";

import { useState, useCallback } from "react";
import type { UploadedDocument, DocumentContext } from "@/lib/types";
import { parseFile, buildSummary } from "@/lib/parsers";
import { generateId, getFileType, formatCurrency } from "@/lib/utils";

export function useDocuments() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addDocument = useCallback(async (file: File) => {
    const fileType = getFileType(file.name);
    if (!fileType) {
      setUploadError("Unsupported file type. Please upload CSV, XLSX, PDF, or DOCX.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { rows, rawText } = await parseFile(file);
      const summary = buildSummary(rows, rawText);

      const doc: UploadedDocument = {
        id: generateId(),
        filename: file.name,
        size: file.size,
        type: fileType,
        uploadedAt: Date.now(),
        file,
        rows,
        rawText,
        summary,
      };

      setDocuments((prev) => [...prev, doc]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const downloadDocument = useCallback((doc: UploadedDocument) => {
    const url = URL.createObjectURL(doc.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const getDocumentContext = useCallback((): DocumentContext[] => {
    return documents.map((doc) => {
      const cur = doc.summary.currency || "$";
      const fmt = (n: number) => `${cur}${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return {
        filename: doc.filename,
        summary: `${doc.summary.totalTransactions} transactions, total ${fmt(doc.summary.totalAmount)}${doc.summary.dateRange ? `, from ${doc.summary.dateRange.start} to ${doc.summary.dateRange.end}` : ""}. Currency: ${cur}. Top categories: ${doc.summary.topCategories.map((c) => `${c.name} ${fmt(c.amount)}`).join(", ")}`,
        sampleRows: doc.summary.sampleRows,
      };
    });
  }, [documents]);

  const getAllRows = useCallback(() => {
    return documents.flatMap((d) => d.rows);
  }, [documents]);

  return {
    documents,
    isUploading,
    uploadError,
    addDocument,
    removeDocument,
    downloadDocument,
    getDocumentContext,
    getAllRows,
    clearUploadError: () => setUploadError(null),
  };
}
