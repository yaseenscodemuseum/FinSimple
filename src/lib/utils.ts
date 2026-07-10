export function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function getFileType(filename: string): "csv" | "xlsx" | "pdf" | "docx" | null {
  const ext = getFileExtension(filename);
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}
