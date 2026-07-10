import type { TransactionRow, DocumentSummary } from "./types";

export interface ParseResult {
  rows: TransactionRow[];
  rawText: string;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "csv":
      return parseCSV(file);
    case "xlsx":
    case "xls":
      return parseExcel(file);
    case "pdf":
      return parsePDF(file);
    case "docx":
      return parseDOCX(file);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

async function parseCSV(file: File): Promise<ParseResult> {
  const text = await file.text();
  const rows = csvTextToRows(text);
  return { rows, rawText: text };
}

async function parseExcel(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Empty spreadsheet");

  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const rows = csvTextToRows(csv);
  return { rows, rawText: csv };
}

async function parsePDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items = content.items.filter(
      (item): item is typeof item & { str: string; transform: number[] } =>
        "str" in item && "transform" in item
    );

    if (items.length === 0) continue;

    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let lastY = items[0].transform[5];

    for (const item of items) {
      const y = item.transform[5];
      if (Math.abs(y - lastY) > 5) {
        if (currentLine.length > 0) lines.push(currentLine);
        currentLine = [];
        lastY = y;
      }
      if (item.str.trim()) currentLine.push(item.str.trim());
    }
    if (currentLine.length > 0) lines.push(currentLine);

    const pageText = lines.map((l) => l.join(" ")).join("\n");
    textParts.push(pageText);
  }

  const rawText = textParts.join("\n");

  if (rawText.replace(/\s/g, "").length < 50) {
    throw new Error(
      "This PDF appears to be scanned (image-only). Please try uploading a CSV or Excel export of your statement instead."
    );
  }

  const rows = extractRowsFromText(rawText);
  return { rows, rawText };
}

async function parseDOCX(file: File): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const rawText = result.value;
  const rows = extractRowsFromText(rawText);
  return { rows, rawText };
}

function csvTextToRows(text: string): TransactionRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const dateIdx = findColumnIndex(header, ["date", "transaction date", "posting date", "trans date"]);
  const descIdx = findColumnIndex(header, ["description", "desc", "memo", "merchant", "payee", "narrative", "details", "transaction"]);
  const amountIdx = findColumnIndex(header, ["amount", "debit", "value", "sum", "total"]);

  if (dateIdx === -1 || amountIdx === -1) {
    return lines.slice(1).map((line) => ({
      date: "",
      description: line,
      amount: 0,
    }));
  }

  const rows: TransactionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const amount = parseAmount(cols[amountIdx] ?? "");
    if (isNaN(amount)) continue;

    rows.push({
      date: cols[dateIdx]?.trim() ?? "",
      description: cols[descIdx >= 0 ? descIdx : 0]?.trim() ?? "",
      amount,
    });
  }

  return rows;
}

function findColumnIndex(headerLine: string, candidates: string[]): number {
  const cols = splitCSVLine(headerLine).map((c) => c.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = cols.findIndex((c) => c.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/[$,\s"]/g, "").replace(/\((.+)\)/, "-$1");
  return parseFloat(cleaned);
}

function extractRowsFromText(text: string): TransactionRow[] {
  const rows: TransactionRow[] = [];
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  const amountWithDecimal = /\d{1,3}(?:,\d{3})*\.\d{2}/g;

  const lines = text.split("\n");

  interface AnchorLine {
    index: number;
    date: string;
    amount: number;
    isDebit: boolean;
    inlineDesc: string;
  }

  const anchors: AnchorLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const amounts = Array.from(line.matchAll(amountWithDecimal)).map((m) => ({
      value: parseAmount(m[0]),
      index: m.index!,
    }));

    if (amounts.length === 0) continue;

    const txnAmount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];

    const dateEnd = dateMatch.index! + dateMatch[0].length;
    let inlineDesc = line.slice(dateEnd, txnAmount.index).replace(/\s+/g, " ").trim();
    inlineDesc = inlineDesc.replace(/^\d+\s*/, "");

    const fullLine = line;
    const isDebit = /\bDR\b/i.test(fullLine);

    anchors.push({
      index: i,
      date: dateMatch[1],
      amount: txnAmount.value,
      isDebit,
      inlineDesc,
    });
  }

  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a];
    const prevEnd = a > 0 ? anchors[a - 1].index + 1 : anchor.index;
    const lookback = Math.max(prevEnd, anchor.index - 3);

    const descParts: string[] = [];
    for (let j = lookback; j < anchor.index; j++) {
      const l = lines[j].trim();
      if (l && !/^SI\s|^Date\s|^Particulars|^Chq\s|^Withdrawal|^Deposit|^Balance|^Summary|^Total|^STATEMENT|^DETAILS|^Name|^Account|^Branch|^LINKED|^Scheme|^No Records|^Disclaimer|^Facility|^Linked or|^IFSC|^MICR|^C\/O|^Phone|^E-Mail|^Generated|^Nomination|^Re KYC|Account Number|Account Open|Account Type/i.test(l)) {
        descParts.push(l);
      }
    }

    if (anchor.inlineDesc) descParts.push(anchor.inlineDesc);

    let desc = descParts.join(" ").replace(/\s+/g, " ").trim();
    if (!desc || desc.length < 3) continue;

    const isDebit = anchor.isDebit || /\bDR\b/i.test(desc);
    const amount = isDebit ? -anchor.amount : anchor.amount;

    rows.push({
      date: anchor.date,
      description: desc,
      amount,
    });
  }

  return rows;
}

export function buildSummary(rows: TransactionRow[], rawText?: string): DocumentSummary {
  if (rows.length === 0) {
    return {
      totalTransactions: 0,
      totalAmount: 0,
      dateRange: null,
      topCategories: [],
      sampleRows: [],
    };
  }

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  const dates = rows
    .map((r) => r.date)
    .filter(Boolean)
    .sort();

  const categoryMap = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category || guessCategory(row.description);
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(row.amount));
  }

  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const currency = rawText ? detectCurrency(rawText) : undefined;
  const sym = currency || "";

  const sampleRows = rows.slice(0, 15).map(
    (r) => `${r.date}, ${r.description}, ${sym}${r.amount.toFixed(2)}`
  );

  return {
    totalTransactions: rows.length,
    totalAmount,
    dateRange: dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null,
    topCategories,
    sampleRows,
    currency,
  };
}

function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  if (/union bank of india|state bank of india|hdfc|icici|axis bank|kotak|punjab national|canara bank|bank of baroda|indian bank|₹|inr|\brs\.?\b|\brupee/i.test(t))
    return "₹";
  if (/\$|usd|\bus\s?dollar/i.test(t)) return "$";
  if (/€|eur|\beuro/i.test(t)) return "€";
  if (/£|gbp|\bpound/i.test(t)) return "£";
  return "";
}

function guessCategory(description: string): string {
  const d = description.toLowerCase();

  if (/zomato|swiggy|uber\s?eats|doordash|grubhub|mcdonald|starbucks|chipotle|pizza|pinoz|restaurant|cafe|food|dining|eat|domino/i.test(d))
    return "Food & Dining";
  if (/netflix|spotify|hulu|disney|youtube|subscription|apple\s?(music|tv)|google\s?p|playstore|adani\s?ai/i.test(d))
    return "Subscriptions";
  if (/amazon|walmart|target|costco|flipkart|myntra|ajio|meesho|shop|\bstore\b|market/i.test(d))
    return "Shopping";
  if (/uber|lyft|gas|shell|exxon|chevron|parking|transit|metro|ola\b|rapido/i.test(d))
    return "Transport";
  if (/rent|mortgage|electric|water|internet|comcast|att|verizon|utility|pg&e|airtel|jio|vodafone|bsnl|broadband|recharge/i.test(d))
    return "Bills & Utilities";
  if (/mutual\s?fund|sip|zerodha|groww|upstox|angel\s?one|kuvera|coin|mf\s?purchase|nps|ppf|fd\s|fixed\s?dep|stock|share|demat|trading|invest|smallcase|etf|bond/i.test(d))
    return "Investments";
  if (/valve|steam|epic\s?games|playstation|xbox|gaming|nintendo/i.test(d))
    return "Gaming";
  if (/neft|imps|rtgs|transfer|zelle|venmo|paypal|cashapp|wire|wisepay/i.test(d))
    return "Transfers";
  if (/atm|withdraw|cash/i.test(d))
    return "Cash & ATM";
  if (/gym|fitness|health|doctor|pharmacy|cvs|walgreens|apollo|medplus|practo|1mg/i.test(d))
    return "Health & Fitness";
  if (/salary|payroll|direct dep|income/i.test(d))
    return "Income";
  if (/sms\s?bank|banking\s?charge|service\s?charge|gst|tax/i.test(d))
    return "Bank Charges";
  if (/\bupi\b|upiar|upiab|bharatpe|paytm|phonepe|gpay/i.test(d))
    return "UPI Payments";

  return "Other";
}
