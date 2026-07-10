# FinSimple — Project Plan

**"Explain My Finances Like I'm 10"**

A conversational finance assistant that ingests your bank statements and documents, analyzes your spending in plain language, and generates actionable reports — all through a chat interface.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Chart.js |
| File Parsing | SheetJS (CSV/Excel), Mammoth.js (DOCX), pdf.js (PDF) — run in a Web Worker |
| File Storage | **None** — original files kept in-memory; download via blob URLs (session-only app) |
| Validation | Zod — validate LLM-returned report JSON, repair-retry on failure |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) — protect the server-env OpenRouter key |
| AI Backend | OpenRouter API (server-side, key in env; endpoints rate-limited) |
| Deployment | Vercel (free hobby tier → `finsimple.vercel.app`) |

> **Decisions locked:** key lives server-side (no user-facing key modal) and is protected by rate limiting; no S3 — files stay in browser memory and download via blob URLs. This removes the AWS setup, the `/api/upload` route, and the liability of storing bank statements.

---

## 2. AI Model Failback Chain

All calls route through `/api/chat` and `/api/report` server-side routes.

> ⚠️ **Verify these model slugs against OpenRouter's live model list before building** — the names and cited stats below look unverified, and a nonexistent slug 404s the whole chain. Prioritize reliable instruction-following + JSON mode over huge context windows (we no longer dump raw docs every turn — see §6). Fill this table in from the actual catalog.

| Priority | Model | Why |
|----------|-------|-----|
| 1 (Primary) | `TBD — verify` | Strong reasoning + reliable JSON/structured output. |
| 2 (Fallback) | `TBD — verify` | Different provider for resilience. |
| 3 (Last Resort) | `TBD — verify` | Cheap, reliable backup. |

**Failback logic (in `lib/openrouter.ts`):**
```
for each model in [m1, m2, m3]:
    try: call OpenRouter with model (tight per-attempt timeout, ~4-5s to first token)
    if success: return response
    if error/timeout: log, continue to next
throw "All models failed"
```

**Streaming caveat:** failback only applies to connection / first-token errors. Once the chat response starts streaming (SSE), a mid-stream failure surfaces as an error — no silent retry (the client already rendered partial text). Reports (non-streamed JSON) get the full 3-model chain. Keep per-attempt timeouts tight so a 3-model chain still fits Vercel Hobby's ~10s function budget.

---

## 3. Color Palette

Derived from the slate-blue/lavender reference image.

### Light Mode
| Element | Color |
|---------|-------|
| Background gradient | `#B8C4DC` → `#D0D8EA` → `#C2CCE0` |
| Chat area | `rgba(255, 255, 255, 0.6)` (frosted glass) |
| Sidebar | `rgba(255, 255, 255, 0.4)` |
| User bubble | `#5B6FA3` (text white) |
| AI bubble | `#E8ECF4` (text dark) |
| Accent | `#4A5E8A` |
| Text primary | `#1A1F2E` |
| Text secondary | `#6B7394` |

### Dark Mode
| Element | Color |
|---------|-------|
| Background gradient | `#0F1318` → `#161C28` → `#131825` |
| Chat area | `rgba(30, 37, 53, 0.7)` |
| Sidebar | `rgba(26, 31, 46, 0.8)` |
| User bubble | `#3D4E7A` (text white) |
| AI bubble | `#1E2535` (text light) |
| Accent | `#6B8ACD` |
| Text primary | `#E2E6EF` |
| Text secondary | `#8891A8` |

---

## 4. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                         FinSimple                     Context    │
├─────────────────────────────────────────┬────────────────────────┤
│                                         │  [Documents] [Reports] │
│                                         │                        │
│           Chat Messages                 │  ┌──────────────────┐  │
│                                         │  │ statement.csv    │  │
│  ┌─────────────────────────────────┐    │  │ ⊡ View ⬇ ✕      │  │
│  │ 🧑 "Where's my money going?"   │    │  ├──────────────────┤  │
│  └─────────────────────────────────┘    │  │ bank-apr.pdf     │  │
│                                         │  │ ⊡ View ⬇ ✕      │  │
│  ┌─────────────────────────────────┐    │  └──────────────────┘  │
│  │ 🤖 "Okay so here's the deal... │    │                        │
│  │ You spent $420 on food this     │    │  ── Reports ──         │
│  │ month. That's like buying 84    │    │                        │
│  │ pizzas! ..."                    │    │  ┌──────────────────┐  │
│  └─────────────────────────────────┘    │  │ 📊 Spending      │  │
│                                         │  │    Breakdown      │  │
│                                         │  │ ⊡ View ⬇         │  │
│                                         │  └──────────────────┘  │
│                                         │                        │
├─────────────────────────────────────────┤                        │
│  [+]  [ Type a message...         ] [→] │                        │
└─────────────────────────────────────────┴────────────────────────┘
```

- **Left (75%):** Chat area with message history, scrollable. Input bar pinned to bottom.
- **Right (25%):** Context sidebar with two tabs — Documents and Reports.
- Responsive: sidebar collapses to a slide-out drawer on mobile.

---

## 5. Project Structure

```
finsimple/
├── app/
│   ├── layout.tsx              # Root layout — dark/light theme, fonts, global wrapper
│   ├── page.tsx                # Main page — assembles ChatArea + ContextSidebar
│   ├── globals.css             # Tailwind directives + gradient backgrounds + theme vars
│   ├── api/
│   │   ├── chat/route.ts       # POST: user message + doc summary → OpenRouter (failback, rate-limited)
│   │   └── report/route.ts     # POST: narrates code-computed report data → OpenRouter (rate-limited)
│   └── providers.tsx           # Theme provider, context providers
│
├── components/
│   ├── ChatArea.tsx            # Scrollable message list + auto-scroll to bottom
│   ├── ChatInput.tsx           # Text input + "+" file upload button + send button
│   ├── MessageBubble.tsx       # Renders user/AI messages with distinct styling
│   ├── ContextSidebar.tsx      # Right panel shell — tab switching
│   ├── DocumentList.tsx        # Lists uploaded docs with view/download/remove actions
│   ├── DocumentCard.tsx        # Single doc card — file icon, name, size, action buttons
│   ├── ReportList.tsx          # Lists generated reports with view/download actions
│   ├── ReportCard.tsx          # Single report — title, summary, embedded chart, actions
│   ├── ReportChart.tsx         # Chart.js wrapper for spending/projection visualizations
│   ├── FileUploadModal.tsx     # Modal triggered by "+" — drag-drop + file picker
│   ├── ThemeToggle.tsx         # Light/dark mode switch
│   └── ReportGenerator.tsx     # "Generate Report" button + report type selector
│
├── lib/
│   ├── openrouter.ts           # Failback chain logic — tries 3 models in sequence
│   ├── parsers.ts              # File parsing (Web Worker): CSV, XLSX, PDF, DOCX → normalized rows
│   ├── analyze.ts              # Deterministic aggregation in JS: categorize, totals, recurring, projections
│   ├── ratelimit.ts            # Upstash rate-limit helper wrapping the API routes
│   ├── schemas.ts              # Zod schemas for report JSON — validate + repair-retry
│   ├── prompts.ts              # System prompts for chat and each report type
│   ├── types.ts                # TypeScript interfaces: Message, Document, Report, etc.
│   └── utils.ts                # Formatting helpers, file size display, date formatting
│
├── hooks/
│   ├── useChat.ts              # Chat state management — messages, sending, loading
│   ├── useDocuments.ts         # Document state — parse, normalize, keep File in memory, remove, list
│   └── useReports.ts           # Report state — generate, store, remove
│
├── .env.local                  # OPENROUTER_API_KEY, UPSTASH_REDIS_REST_URL/TOKEN
├── package.json
├── tailwind.config.ts          # Custom colors (slate-blue palette), dark mode config
├── tsconfig.json
└── next.config.js
```

---

## 6. Core Features

### 6a. Chat

**Flow:**
1. User types message (or uploads a file first, then asks about it)
2. Client sends message + a **compact per-document summary** (normalized totals + a bounded sample of rows), **not** the full raw statement on every turn — this keeps token cost, latency, and context-limit pressure down as history grows. Full detail is only pulled in when a report needs it.
3. Server-side route (rate-limited) calls OpenRouter with failback chain
4. System prompt instructs the AI to explain everything in simple, friendly language — "like you're explaining to a smart 10-year-old"
5. Response streams back and renders as an AI bubble
6. AI may proactively suggest: "I noticed some recurring charges — want me to run a subscription report?"

**System prompt (in `lib/prompts.ts`):**
```
You are FinSimple, a friendly financial assistant that explains money 
in the simplest possible terms — like you're talking to a smart 10-year-old.

Use everyday analogies (pizza, video games, allowance). 
Round numbers. Skip jargon. 
If something is bad, say so kindly but clearly.
If you see patterns in the data, point them out proactively.

When the user's documents are provided as context, analyze them 
and reference specific numbers and transactions.
```

### 6b. File Upload

**Supported formats:** CSV, PDF, Excel (.xlsx/.xls), DOCX

**Flow:**
1. User clicks "+" → FileUploadModal opens (drag-drop zone + file picker)
2. File is parsed client-side **in a Web Worker** (keeps large files from freezing the UI):
   - CSV/Excel → SheetJS → normalized transaction rows
   - PDF → pdf.js → extracted text → rows
   - DOCX → Mammoth.js → extracted text
3. **Scanned-PDF guard:** if extracted text is suspiciously short/empty, flag it to the user ("this looks like a scanned image — try a CSV export") instead of silently sending nothing to the AI.
4. Normalized rows + a compact summary stored in React state; the original `File` object is **kept in memory** (no upload).
5. File appears in Context sidebar → Documents tab; Download re-serves the in-memory File via a blob URL.

**Parsing happens client-side** to keep things fast, avoid server costs, and avoid ever storing bank statements server-side.

### 6c. Context Sidebar

**Documents Tab:**
- Shows all uploaded files as cards
- Each card: file type icon, filename, file size, upload date
- Actions per card: **View** (shows parsed content in a modal), **Download** (blob URL from in-memory File), **Remove** (drops from state)

**Reports Tab:**
- Shows all generated reports as cards
- Each card: report type icon, title, generation date, brief summary
- Actions per card: **View** (expands inline with charts), **Download** (HTML file with the chart embedded as a PNG via `canvas.toDataURL()` — simpler and more portable than re-embedding Chart.js + data)
- Reports persist in React state for the session

### 6d. Reports

Four report types, triggered via chat ("find my subscriptions") or the ReportGenerator button:

**1. Spending Breakdown**
- Categorizes all transactions (food, transport, subscriptions, entertainment, bills, etc.)
- Pie chart of category distribution
- Top 5 biggest expenses called out
- Simple language: "You spent $420 on food — that's like buying a new video game every 3 days"

**2. Monthly Projection**
- Based on current spending rate, projects balances at 1/3/6 months
- Line chart showing projected trajectory
- Flags if any projection goes negative
- "At this rate, you'll have $X left in 3 months. That's tight."

**3. Subscription Hunter**
- Identifies recurring charges (same merchant, similar amounts, regular intervals)
- Lists each with: merchant, amount, frequency, annual total
- Flags ones that might be forgotten ("You're paying $9.99/mo to X — have you used it recently?")
- Shows total annual subscription spend

**4. Custom Advice**
- User describes what they want advice on in the chat
- AI analyzes all uploaded docs in context and gives personalized, plain-language advice
- Examples: "Should I be worried about my spending?", "How can I save $500/mo?", "Am I spending too much on food?"

**Report generation flow (compute in code, narrate with AI):**
1. User requests report (chat or button).
2. **`lib/analyze.ts` computes the numbers deterministically in JS** — category totals, top expenses, recurring-charge detection, projections. LLMs are unreliable at summing hundreds of transactions, so headline figures must come from code, not the model.
3. Client sends the *computed* report data (not raw statement dumps) + report type to `/api/report`.
4. Server calls OpenRouter only for the **plain-language narration/insights**, requesting JSON that is validated against a Zod schema (`lib/schemas.ts`) with a repair-retry on malformed output. Use OpenRouter's JSON mode where supported.
5. Client merges code-computed numbers + AI narration → renders ReportCard with Chart.js.
6. Report saved to Reports tab in sidebar.

This makes every number correct even if the AI call degrades, and keeps calls small/cheap. Ambiguous merchant categorization can optionally be assisted by the LLM, but totals are always code-side.

---

## 7. Rate Limiting & Privacy

**Why:** the OpenRouter key lives in server env, so the API routes are a public, credit-spending surface. Rate-limit them.

**Rate limiting (`lib/ratelimit.ts`):**
- Upstash Redis + `@upstash/ratelimit`, keyed by client IP (`x-forwarded-for` on Vercel).
- Apply to `/api/chat` and `/api/report`. Suggested: sliding window, e.g. ~20 requests/min/IP — tune to your budget.
- On limit exceeded → HTTP 429 with a friendly message.
- Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**Privacy:** bank data is parsed in the browser and only summaries are sent to third-party model providers via OpenRouter; original files never leave memory. Show a one-line consent notice on first use ("Your documents are analyzed by an AI provider; nothing is stored on our servers.").

---

## 8. API Routes

### `POST /api/chat`

**Request:** (send compact summaries, not raw statement dumps — see §6a)
```json
{
  "message": "Where is my money going?",
  "context": [
    { "filename": "statement.csv", "summary": "142 txns, total -$3,200; top: Food $420, Rent $1,400...", "sampleRows": ["2026-06-01,Whole Foods,-84.20", "..."] }
  ],
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Server logic:**
1. Rate-limit check (429 if exceeded).
2. Build messages array: system prompt + history + user message with document summaries.
3. Call OpenRouter with failback chain (first-token errors fall back; mid-stream errors surface — see §2).
4. Stream response back to client.

**Response:** Streamed text (SSE)

---

### `POST /api/report`

**Request:** (client sends the code-computed numbers; the route only asks the AI to narrate)
```json
{
  "type": "spending_breakdown | monthly_projection | subscription_hunter | custom_advice",
  "computed": { "categories": [{ "name": "Food & Dining", "amount": 420 }], "total": 3200, "topExpenses": [] },
  "customPrompt": "How can I save $500/month?"  // only for custom_advice
}
```

**Server logic:**
1. Rate-limit check (429 if exceeded).
2. Select report-specific system prompt from `lib/prompts.ts`.
3. Send the computed figures; ask OpenRouter (failback chain) for plain-language insights as JSON.
4. Validate against the Zod schema (`lib/schemas.ts`); repair-retry on malformed JSON.
5. Return `{ computed numbers + AI narration }`.

**Response:**
```json
{
  "title": "Spending Breakdown — June 2026",
  "summary": "You spent $3,200 total across 6 categories.",
  "data": {
    "categories": [
      { "name": "Food & Dining", "amount": 420, "percentage": 13.1 },
      { "name": "Subscriptions", "amount": 89, "percentage": 2.8 }
    ],
    "insights": ["Your food spending is 30% higher than last month..."],
    "chartType": "pie"
  }
}
```

---

> **No `/api/upload`.** Files are parsed in the browser and kept in memory; downloads are served from a blob URL. Nothing is uploaded.

---

## 9. Deployment

### Vercel
1. Push repo to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `OPENROUTER_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Deploy → live at `finsimple.vercel.app`

### Upstash
1. Create a Redis database (free tier) → copy REST URL + token into env.

**Note — Vercel Hobby limits:** serverless functions cap around 10s. Keep per-model timeouts tight (§2) so a 3-model failback chain still completes in budget.

---

## 10. Build Order

| Phase | Tasks | Depends On |
|-------|-------|------------|
| **1. Scaffold** | `npx create-next-app`, Tailwind config, color palette, dark/light theme, layout shell | — |
| **2. Chat UI** | ChatArea, ChatInput, MessageBubble, theme toggle | Phase 1 |
| **3. API Integration** | `/api/chat` route, `lib/openrouter.ts` failback chain, streaming, rate limiting, `useChat` hook | Phase 2 |
| **4. File Upload** | FileUploadModal, `lib/parsers.ts` (Web Worker), scanned-PDF guard, in-memory File + blob download, `useDocuments` hook | Phase 2 |
| **5. Context Sidebar** | ContextSidebar, DocumentList, DocumentCard, tabs | Phase 4 |
| **6. Analysis Engine** | `lib/analyze.ts` deterministic aggregation (categories, recurring, projections), `lib/schemas.ts` Zod | Phase 4 |
| **7. Reports** | ReportGenerator, `/api/report`, ReportCard, ReportChart, `useReports` hook | Phase 3 + 6 |
| **8. Polish** | Responsive mobile layout, loading states, error/429 handling, privacy notice, animations | Phase 7 |
| **9. Deploy** | Vercel deploy, Upstash setup, env vars, verify model slugs, test end-to-end | Phase 8 |
