import { z } from "zod";

export const NarrationSchema = z.object({
  summary: z.string().min(1),
  insights: z.array(z.string()).min(1).max(10),
});

export type Narration = z.infer<typeof NarrationSchema>;

export function parseNarration(raw: string): Narration {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      summary: raw.slice(0, 200),
      insights: [raw.slice(0, 500)],
    };
  }

  const result = NarrationSchema.safeParse(parsed);
  if (result.success) return result.data;

  const obj = parsed as Record<string, unknown>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "Report generated.",
    insights: Array.isArray(obj.insights)
      ? obj.insights.filter((i): i is string => typeof i === "string")
      : ["See the computed data above for details."],
  };
}
