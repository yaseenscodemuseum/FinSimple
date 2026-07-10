import { NextRequest } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/ratelimit";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { DocumentContext, UserProfile } from "@/lib/types";

interface ChatRequest {
  message: string;
  context: DocumentContext[];
  history: { role: "user" | "assistant"; content: string }[];
  userProfile?: UserProfile;
}

export async function POST(request: NextRequest) {
  const { success } = await checkRateLimit(request);
  if (!success) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { message, context = [], history = [], userProfile } = body;

  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "Message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let contextBlock = "";

  if (userProfile && Object.values(userProfile).some(v => v)) {
    const parts: string[] = [];
    if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
    if (userProfile.age) parts.push(`Age: ${userProfile.age}`);
    if (userProfile.profession) parts.push(`Profession: ${userProfile.profession}`);
    if (userProfile.bankBalance) parts.push(`Bank balance: ${userProfile.bankBalance}`);
    if (userProfile.income) parts.push(`Pocket money / Salary: ${userProfile.income}`);
    if (userProfile.addedContext) parts.push(`Additional context: ${userProfile.addedContext}`);
    contextBlock += `\n\nAbout the user:\n${parts.join("\n")}`;
  }

  if (context.length > 0) {
    const parts = context.map(
      (doc) =>
        `--- ${doc.filename} ---\n${doc.summary}\nSample rows:\n${doc.sampleRows.slice(0, 10).join("\n")}`
    );
    contextBlock += `\n\nUser's uploaded documents:\n${parts.join("\n\n")}`;
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT + contextBlock },
    ...history.slice(-20).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const response = await callOpenRouter(messages, { stream: true });

    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // skip malformed SSE chunks
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
