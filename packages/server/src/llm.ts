// packages/server/src/llm.ts

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Environment setup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const CHAT_MODEL = process.env.REPLIES_MODEL ?? "gpt-4o-mini";
const MODERATION_MODEL = process.env.MODERATION_MODEL ?? "omni-moderation-latest";

// --- optional debug logging (safe no-op unless enabled) ---
const LOG_LLM = process.env.LOG_LLM === "1";
function logLLM(msg: string, meta?: Record<string, unknown>) {
  if (!LOG_LLM) return;
  try {
    console.error(`[llm] ${msg}`, meta ? JSON.stringify(meta) : "");
  } catch { /* ignore */ }
}

// --- simple concurrency gate to avoid bursty 429s ---
let inFlight = 0;
const MAX_PARALLEL = Number(process.env.OPENAI_MAX_PARALLEL ?? 4);

// tiny retry helper
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withGate<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight >= MAX_PARALLEL) {
    await sleep(25);
  }
  inFlight++;
  try { return await fn(); }
  finally { inFlight--; }
}

// Replace your existing safeFetch with this one:
async function safeFetch(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  return withGate(async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const maxAttempts = 2; // 1 try + 1 retry on 429/5xx
    let lastErr: any;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(url, { ...init, signal: ac.signal });
          if (res.status >= 500 || res.status === 429) {
            if (attempt < maxAttempts) {
              logLLM("retrying openai", { url, status: res.status, attempt });
              const jitter = 100 + Math.floor(Math.random() * 200);
              await sleep(jitter);
              continue;
            }
          } else if (!res.ok) {
            logLLM("openai non-ok", { url, status: res.status });
          }
          return res;
        } catch (e) {
          lastErr = e;
          if (attempt < maxAttempts) {
            logLLM("retrying openai after error", { url, attempt });
            const jitter = 100 + Math.floor(Math.random() * 200);
            await sleep(jitter);
            continue;
          }
          throw e;
        }
      }
      throw lastErr ?? new Error("safeFetch: unknown error");
    } finally {
      clearTimeout(t);
    }
  });
}

/**
 * Uses OpenAI moderation endpoint to flag inappropriate content.
 */
export async function moderateText(text: string): Promise<{
  flagged: boolean;
  category?: "spam" | "negative" | "harassment" | "self-harm" | "sexual" | "violence" | "hate";
  score?: number;
}> {
  if (!OPENAI_API_KEY) return { flagged: false };

  try {
    const res = await safeFetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: text,
      }),
    });

    if (!res.ok) {
      console.error("moderateText status:", res.status, await res.text());
      return { flagged: false };
    }

    const json: any = await res.json();
    const r = json?.results?.[0];
    if (!r) return { flagged: false };

    const scores = r.category_scores ?? {};
    const pick = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1])[0];
    const topCat = (pick?.[0] ?? "") as string;

    const map: Record<string, any> = {
      "harassment": "harassment",
      "harassment/threats": "harassment",
      "hate": "hate",
      "hate/threats": "hate",
      "self-harm": "self-harm",
      "sexual/minors": "sexual",
      "sexual": "sexual",
      "violence": "violence",
      "violence/graphic": "violence",
      "self-harm/intent": "self-harm",
      "self-harm/instructions": "self-harm",
      "sexual/violent": "sexual",
      "spam": "spam", // not standard, but caught elsewhere
    };

    return {
      flagged: !!r.flagged,
      category: map[topCat] ?? undefined,
      score: typeof pick?.[1] === "number" ? pick[1] : undefined,
    };
  } catch (err) {
    console.error("moderateText error:", err);
    return { flagged: false };
  }
}

/**
 * Uses OpenAI chat completions to generate a contextual short reply.
 */
export async function chatReply(system: string, user: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.warn("chatReply: OPENAI_API_KEY not set, returning null");
    return null;
  }

  try {
    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as ChatMessage[],
        temperature: 0.7,
        max_tokens: 180,
      }),
    });

    if (!res.ok) {
      console.error("chatReply status:", res.status, await res.text());
      return null;
    }

    const json: any = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    console.warn("chatReply: empty response from OpenAI");
    return null;
  } catch (err) {
    console.error("chatReply error:", err);
    return null;
  }
}
