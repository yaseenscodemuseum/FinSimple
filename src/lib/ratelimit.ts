import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    analytics: true,
  });

  return ratelimit;
}

export async function checkRateLimit(
  request: Request
): Promise<{ success: boolean; remaining: number }> {
  const limiter = getRatelimit();

  if (!limiter) {
    return { success: true, remaining: 999 };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "127.0.0.1";

  const { success, remaining } = await limiter.limit(ip);
  return { success, remaining };
}
