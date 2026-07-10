type Provider = "anthropic" | "gemini" | "openai" | "openrouter";

const FAILBACK_TIMEOUT_MS = 5_000;
const DIRECT_TIMEOUT_MS = 15_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  json?: boolean;
  stream?: boolean;
  signal?: AbortSignal;
}

interface ProviderConfig {
  name: Provider;
  apiKey: string;
  models: string[];
}

function buildProvider(name: Provider, customModel?: string): ProviderConfig {
  switch (name) {
    case "anthropic":
      return {
        name: "anthropic",
        apiKey: requireKey("ANTHROPIC_API_KEY"),
        models: customModel ? [customModel] : ["claude-sonnet-4-20250514"],
      };
    case "gemini":
      return {
        name: "gemini",
        apiKey: requireKey("GOOGLE_API_KEY"),
        models: customModel ? [customModel] : ["gemini-2.0-flash"],
      };
    case "openai":
      return {
        name: "openai",
        apiKey: requireKey("OPENAI_API_KEY"),
        models: customModel ? [customModel] : ["gpt-4o-mini"],
      };
    default:
      return {
        name: "openrouter",
        apiKey: requireKey("OPENROUTER_API_KEY"),
        models: customModel
          ? [customModel]
          : ["openai/gpt-oss-120b", "tencent/hy3", "nvidia/nemotron-3-ultra-550b-a55b"],
      };
  }
}

function getProviders(): ProviderConfig[] {
  const explicit = process.env.AI_PROVIDER as Provider | undefined;
  const custom = process.env.AI_MODEL;

  if (explicit) return [buildProvider(explicit, custom)];

  const providers: ProviderConfig[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push(buildProvider("anthropic", custom));
  if (process.env.GOOGLE_API_KEY) providers.push(buildProvider("gemini", custom));
  if (process.env.OPENAI_API_KEY) providers.push(buildProvider("openai", custom));
  if (process.env.OPENROUTER_API_KEY) providers.push(buildProvider("openrouter", custom));

  if (providers.length === 0) {
    throw new Error(
      "No AI API key found. Set ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY"
    );
  }

  return providers;
}

function requireKey(name: string): string {
  const key = process.env[name];
  if (!key) throw new Error(`${name} is not set`);
  return key;
}

// ── Main exports ──

export async function callOpenRouter(
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<Response> {
  const providers = getProviders();
  const errors: string[] = [];

  for (const provider of providers) {
    const timeoutMs = provider.name === "openrouter" ? FAILBACK_TIMEOUT_MS : DIRECT_TIMEOUT_MS;

    for (const model of provider.models) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const signal = options.signal
          ? anySignal([controller.signal, options.signal])
          : controller.signal;

        let response: Response;
        switch (provider.name) {
          case "anthropic":
            response = await fetchAnthropic(provider.apiKey, model, messages, options, signal);
            break;
          case "gemini":
            response = await fetchGemini(provider.apiKey, model, messages, options, signal);
            break;
          default:
            response = await fetchOpenAICompat(provider, model, messages, options, signal);
            break;
        }

        clearTimeout(timeout);

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          errors.push(`[${provider.name}] ${model}: HTTP ${response.status} — ${text.slice(0, 200)}`);
          continue;
        }

        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (options.signal?.aborted) throw err;
        errors.push(`[${provider.name}] ${model}: ${msg}`);
        continue;
      }
    }
  }

  const hasLimitError = errors.some(
    (e) => e.includes("limit exceeded") || e.includes("quota") || e.includes("rate_limit")
  );
  if (hasLimitError) {
    throw new Error("API key limit exceeded. Please check your usage limits.");
  }
  throw new Error("AI is temporarily unavailable. Please try again in a moment.");
}

export async function callOpenRouterJSON(
  messages: ChatMessage[]
): Promise<string> {
  const response = await callOpenRouter(messages, { json: true });
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── OpenAI-compatible (OpenRouter + OpenAI) ──

async function fetchOpenAICompat(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  options: CallOptions,
  signal: AbortSignal
): Promise<Response> {
  const url =
    provider.name === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const extraHeaders: Record<string, string> =
    provider.name === "openrouter"
      ? { "HTTP-Referer": "https://finsimple.vercel.app", "X-Title": "FinSimple" }
      : {};

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: options.stream ?? false,
  };
  if (options.json) body.response_format = { type: "json_object" };

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal,
  });
}

// ── Anthropic (Claude) ──

async function fetchAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: CallOptions,
  signal: AbortSignal
): Promise<Response> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: 4096,
    stream: options.stream ?? false,
  };
  if (systemMsg) body.system = systemMsg.content;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) return response;
  if (options.stream) return transformAnthropicStream(response);
  return normalizeAnthropicJSON(response);
}

async function normalizeAnthropicJSON(response: Response): Promise<Response> {
  const data = await response.json();
  const content = data.content?.[0]?.text ?? "";
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function transformAnthropicStream(response: Response): Response {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })}\n\n`
                  )
                );
              }
            } catch {}
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── Google Gemini ──

async function fetchGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: CallOptions,
  signal: AbortSignal
): Promise<Response> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = { contents: chatMessages };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  if (options.json) body.generationConfig = { responseMimeType: "application/json" };

  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;
  const url = options.stream
    ? `${base}:streamGenerateContent?alt=sse`
    : `${base}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) return response;
  if (options.stream) return transformGeminiStream(response);
  return normalizeGeminiJSON(response);
}

async function normalizeGeminiJSON(response: Response): Promise<Response> {
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function transformGeminiStream(response: Response): Response {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
                  )
                );
              }
            } catch {}
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── Helpers ──

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}
