import { NextRequest, NextResponse } from "next/server";
import { callOpenRouterJSON } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/ratelimit";
import { getReportPrompt } from "@/lib/prompts";
import { parseNarration } from "@/lib/schemas";
import type { ReportType } from "@/lib/types";

interface ReportRequest {
  type: ReportType;
  computed: Record<string, unknown>;
  customPrompt?: string;
}

export async function POST(request: NextRequest) {
  const { success } = await checkRateLimit(request);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: ReportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, computed, customPrompt } = body;
  if (!type || !computed) {
    return NextResponse.json({ error: "Missing type or computed data" }, { status: 400 });
  }

  const systemPrompt = getReportPrompt(type);

  let userContent = `Here is the computed financial data:\n${JSON.stringify(computed, null, 2)}`;
  if (type === "custom_advice" && customPrompt) {
    userContent += `\n\nUser's question: ${customPrompt}`;
  }

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callOpenRouterJSON(messages);
      const narration = parseNarration(raw);
      return NextResponse.json({ narration });
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        const msg = err instanceof Error ? err.message : "Report generation failed";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Report generation failed" }, { status: 502 });
}
