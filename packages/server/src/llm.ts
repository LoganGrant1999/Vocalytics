// packages/server/src/llm.ts
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const CHAT_MODEL = process.env.REPLIES_MODEL ?? "gpt-4o-mini";
const MODERATION_MODEL = process.env.MODERATION_MODEL ?? "omni-moderation-latest";

async function safeFetch(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

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
      body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
    });
    if (!res.ok) return { flagged: false };
    const json: any = await res.json();
    const r = json?.results?.[0];
    if (!r) return { flagged: false };
    // Heuristic mapping
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
      "spam": "spam", // not standard; we'll detect links too elsewhere
    };
    return {
      flagged: !!r.flagged,
      category: map[topCat] ?? undefined,
      score: typeof pick?.[1] === "number" ? pick[1] : undefined,
    };
  } catch {
    return { flagged: false };
  }
}

export async function chatReply(system: string, user: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
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
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    return (typeof text === "string" && text.trim()) ? text.trim() : null;
  } catch {
    return null;
  }
}
