# FinSimple

Your unfiltered best friend who happens to be really good with money. Upload bank statements, get roasted for your spending, and actually learn something.

## Features

- **Conversational Finance** - Chat with an AI that talks like your best friend, not a corporate chatbot. It'll roast your bad spending and hype your wins.
- **Smart Document Parsing** - Upload CSV, XLSX, PDF, or DOCX bank statements. Extracts transactions with intelligent table reconstruction for PDFs.
- **Automatic Categorization** - Transactions are categorized into Food & Dining, Shopping, Transport, Subscriptions, UPI Payments, and more using pattern matching.
- **Currency Detection** - Automatically detects your currency from the document. Indian statements use INR, US statements use USD, etc.
- **Reports & Charts** - Generate spending breakdowns, monthly projections, and subscription hunting reports with interactive charts.
- **User Profiles** - Save your name, age, profession, bank balance, and income for personalized advice.
- **Multi-Provider AI** - Works with Claude, Gemini, OpenAI, or OpenRouter. Set multiple keys and it falls back across providers automatically.
- **Glassmorphism UI** - Clean glassy interface with dark and light mode support.
- **Streaming Responses** - Real-time SSE streaming so you see the AI typing.
- **Privacy First** - All document parsing happens client-side. Your files never leave your browser.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.10 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Anthropic, Google Gemini, OpenAI, or OpenRouter (failback chain) |
| Rate Limiting | Upstash Redis |
| PDF Parsing | pdfjs-dist v6.1.200 |
| Spreadsheets | SheetJS (xlsx) |
| Word Docs | Mammoth.js |
| Charts | Chart.js + react-chartjs-2 |
| Validation | Zod v4 |
| Theme | next-themes |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- An API key from **one or more** of: [Anthropic](https://console.anthropic.com/), [Google AI Studio](https://aistudio.google.com/), [OpenAI](https://platform.openai.com/), or [OpenRouter](https://openrouter.ai/)
- [Upstash](https://upstash.com/) Redis database (for rate limiting)

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yaseenabdulaziz18/FinSimple.git
   cd FinSimple
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in your `.env`. Set one or more AI keys — if multiple are set, FinSimple falls back through them in order (Claude → Gemini → OpenAI → OpenRouter):

   ```env
   # AI provider keys (set one or more, tried in this order):
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx         # 1st: Claude
   GOOGLE_API_KEY=AIzaxxxxxxxxxxxx               # 2nd: Gemini
   OPENAI_API_KEY=sk-xxxxxxxxxxxx                # 3rd: OpenAI
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx      # 4th: OpenRouter (free models)

   # Optional: override the default model
   # AI_MODEL=gpt-4o

   # Optional: force a single provider (skips the failback chain)
   # AI_PROVIDER=anthropic

   # Rate limiting (Upstash Redis)
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
   ```

   See [AI Providers](#ai-providers) below for details on each option.

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## AI Providers

FinSimple supports four AI providers. Set **one or more** API keys and it chains through them automatically. If Claude fails, it tries Gemini. If Gemini fails, it tries OpenAI. And so on.

### Failback order

| Priority | Provider | Default model | Timeout |
|----------|----------|---------------|---------|
| 1 | **Anthropic (Claude)** | `claude-sonnet-4-20250514` | 15s |
| 2 | **Google Gemini** | `gemini-2.0-flash` | 15s |
| 3 | **OpenAI** | `gpt-4o-mini` | 15s |
| 4 | **OpenRouter** | 3-model chain (see below) | 5s per model |

Only providers with a key set are tried. If you only set `GOOGLE_API_KEY`, only Gemini is used. If you set all four, you get the full failback chain.

### OpenRouter's internal chain

When OpenRouter is reached, it tries these free models in order:

| # | Model |
|---|-------|
| 1 | `openai/gpt-oss-120b` |
| 2 | `tencent/hy3` |
| 3 | `nvidia/nemotron-3-ultra-550b-a55b` |

### Overriding the model

Use `AI_MODEL` to override the default model for whichever provider is active:

```env
OPENAI_API_KEY=your_key_here
AI_MODEL=gpt-4o
```

### Forcing a single provider

Set `AI_PROVIDER` to skip the failback chain and use only one provider:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
AI_PROVIDER=openai
```

### Adding a new OpenRouter model

Open `src/lib/openrouter.ts` and find the `buildProvider` function. The OpenRouter models are in the default case:

```typescript
default:
  return {
    name: "openrouter",
    apiKey: requireKey("OPENROUTER_API_KEY"),
    models: customModel
      ? [customModel]
      : ["openai/gpt-oss-120b", "tencent/hy3", "nvidia/nemotron-3-ultra-550b-a55b"],
  };
```

Add or replace model IDs from the [OpenRouter models page](https://openrouter.ai/models). Models are tried in order, so put your preferred one first.

Or just set `AI_MODEL` in `.env` to use a single model without editing code:

```env
AI_MODEL=anthropic/claude-sonnet-4
```

## How It Works

1. **Upload** - Drop a bank statement (PDF, CSV, XLSX, or DOCX). The file is parsed entirely in your browser.

2. **Parse** - PDFs use y-coordinate grouping to reconstruct table rows from scattered text. CSVs and XLSX files are parsed with SheetJS. Each transaction gets auto-categorized.

3. **Analyze** - Financial computations (totals, category breakdowns, projections) run deterministically in JavaScript. No AI hallucination on your numbers.

4. **Chat** - The AI receives a summary and sample rows, not your raw data. It uses those numbers to give you real, personalized advice in a conversational tone.

5. **Report** - Generate structured reports (spending breakdown, monthly projection, subscription hunter) with Chart.js visualizations and AI narration.

## Project Structure

```
src/
  app/
    api/
      chat/route.ts       # SSE streaming chat endpoint
      report/route.ts     # Report generation endpoint
    globals.css           # Glassmorphism theme + Tailwind v4
    layout.tsx            # Root layout with theme provider
    page.tsx              # Main app with sidebar tabs
    providers.tsx         # Theme provider wrapper
  components/
    ChatArea.tsx          # Message list with auto-scroll
    ChatInput.tsx         # Input bar with upload button
    FileUploadModal.tsx   # Drag-and-drop file upload
    MessageBubble.tsx     # Glass-styled chat bubbles
    PrivacyNotice.tsx     # Privacy disclaimer banner
    ReportCard.tsx        # Report display cards
    ReportChart.tsx       # Chart.js visualizations
    ReportGenerator.tsx   # Report type selector
    ThemeToggle.tsx       # Dark/light mode toggle
  hooks/
    useChat.ts            # Chat state + SSE streaming
    useDocuments.ts       # Document upload + parsing
    useReports.ts         # Report generation logic
  lib/
    analyze.ts            # Deterministic financial computations
    openrouter.ts         # Multi-provider AI client
    parsers.ts            # PDF/CSV/XLSX/DOCX parsing
    prompts.ts            # System prompts
    ratelimit.ts          # Upstash rate limiting
    schemas.ts            # Zod validation schemas
    types.ts              # TypeScript interfaces
    utils.ts              # Utility functions
```

## Deployment

### Vercel (Recommended)

```bash
npm run build
npm start
```

Make sure your platform supports Node.js 18+ and has the environment variables set.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/something-cool`)
3. Commit your changes (`git commit -m "Add something cool"`)
4. Push to the branch (`git push origin feature/something-cool`)
5. Open a Pull Request

## License

This project is open source under the [MIT License](LICENSE).

## Credits

If you use this repo, please credit me or send me a photo of you using it on one of my socials — it'd make me really happy to see people appreciating my work.

- **Website**: [yaseensportfolio.vercel.app](https://yaseensportfolio.vercel.app)
- **Instagram**: [@yaleftonseen](https://www.instagram.com/yaleftonseen/)
- **Email**: yaseenabdulaziz18@gmail.com
- **LinkedIn**: [Mohammad Yaseen Abdul Aziz](https://www.linkedin.com/in/mohammad-yaseen-abdul-aziz/)
- **GitHub**: [yaseenscodemuseum](https://github.com/yaseenscodemuseum)
