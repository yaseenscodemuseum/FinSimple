"use client";

import type { Message } from "@/lib/types";

interface Props {
  message: Message;
}

function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\|[-\s|:]+\|$/.test(trimmed)) continue;

    if (/^\|.+\|$/.test(trimmed)) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      const row = cells.map((c) => `<td class="px-2 py-0.5">${bold(c)}</td>`).join("");
      out.push(`<tr>${row}</tr>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { out.push('<ul class="list-disc pl-5 my-1">'); inList = true; }
      out.push(`<li>${bold(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }

    if (trimmed === "") {
      out.push("<br/>");
    } else {
      out.push(`<p class="my-0.5">${bold(trimmed)}</p>`);
    }
  }
  if (inList) out.push("</ul>");

  let html = out.join("\n");
  if (html.includes("<tr>")) {
    html = html.replace(
      /(<tr>[\s\S]*?<\/tr>(?:\s*<tr>[\s\S]*?<\/tr>)*)/g,
      '<table class="my-2 text-left border-collapse">$1</table>'
    );
  }
  return html;
}

function bold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-fade-in`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-md
          ${
            isUser
              ? "bg-[var(--color-bubble-user)] text-[var(--color-text-on-user)] border border-white/10"
              : "bg-[var(--color-bubble-ai)] text-[var(--color-text-on-ai)] border border-[var(--color-glass-border)]"
          }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
        )}
      </div>
    </div>
  );
}
