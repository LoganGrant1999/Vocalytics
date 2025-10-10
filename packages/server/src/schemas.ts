import { z } from 'zod';

export const ToneEnum = z.enum(['friendly', 'concise', 'enthusiastic']);

// Canonical TWComment schema
export const TWCommentZ = z.object({
  id: z.string(),
  videoId: z.string(),
  author: z.string(),
  text: z.string(),
  publishedAt: z.string(),
  likeCount: z.number(),
  replyCount: z.number(),
  isReply: z.boolean(),
  parentId: z.string().optional()
});

export type TWComment = z.infer<typeof TWCommentZ>;
export const TWCommentArrayZ = z.array(TWCommentZ);

export const SentimentScoreSchema = z.object({
  positive: z.number(),
  negative: z.number(),
  neutral: z.number(),
});

export const AnalysisSchema = z.object({
  commentId: z.string(),
  sentiment: SentimentScoreSchema,
  topics: z.array(z.string()),
  intent: z.string(),
  toxicity: z.number(),
});

export const FetchCommentsArgsSchema = z.object({
  videoId: z.string().min(3).optional(),
  channelId: z.string().min(3).optional(),
  max: z.preprocess((v:any) => Number(v), z.number().int().min(1).max(100)).default(50),
  pageToken: z.string().optional(),
  includeReplies: z.boolean().default(false),
  order: z.enum(["time","relevance"]).default("time"),
}).refine(i => !!i.videoId || !!i.channelId, { message:"Provide videoId or channelId" });

export const AnalyzeCommentsArgsSchema = z.object({
  comments: TWCommentArrayZ,
});

export const GenerateRepliesArgsSchema = z.object({
  comment: TWCommentZ,
  tones: z.array(ToneEnum),
});

const SentimentLabel = z.enum(['positive', 'neutral', 'constructive', 'negative', 'spam']);

const AnalysisItem = z.object({
  commentId: z.string(),
  label: SentimentLabel,
});

export const AnalysisPage = z.object({
  items: z.array(AnalysisItem).min(1, 'items must be a non-empty array'),
}).passthrough();

// Be hyper-permissive at the boundary; we'll normalize manually.
export const SummarizeSentimentArgsSchema = z.any();

// ---------- helpers ----------
function safeStringify(v: unknown, max = 800): string {
  try {
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(v);
  }
}

function tryJsonParse<T = unknown>(v: unknown): T | null {
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return null; }
  }
  return null;
}

function looksLikePage(v: any): v is z.infer<typeof AnalysisPage> {
  return v && typeof v === 'object' && Array.isArray(v.items);
}

function looksLikeItem(v: any): v is z.infer<typeof AnalysisItem> {
  return v && typeof v === 'object' && typeof v.commentId === 'string' && typeof v.label === 'string';
}

function coerceLabel(label: string): z.infer<typeof SentimentLabel> | null {
  const L = label as z.infer<typeof SentimentLabel>;
  return (['positive', 'neutral', 'constructive', 'negative', 'spam'] as const).includes(L) ? L : null;
}

// Breadth-first deep search for useful shapes anywhere in the payload.
function* iterateNodes(root: unknown, maxDepth = 6): Generator<any> {
  const q: Array<{v: any, d: number}> = [{ v: root, d: 0 }];
  const seen = new Set<any>();
  while (q.length) {
    const { v, d } = q.shift()!;
    if (v && typeof v === 'object') {
      if (seen.has(v)) continue;
      seen.add(v);
    }
    yield v;
    if (d >= maxDepth) continue;
    if (Array.isArray(v)) {
      for (const el of v) q.push({ v: el, d: d + 1 });
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) q.push({ v: (v as any)[k], d: d + 1 });
    } else if (typeof v === 'string') {
      const parsed = tryJsonParse(v);
      if (parsed != null) q.push({ v: parsed, d: d + 1 });
    }
  }
}

function wrapItemsArrayAsPage(arr: any[]): Array<z.infer<typeof AnalysisPage>> {
  const items = arr.map((it: any) => {
    const lbl = coerceLabel(it?.label);
    if (!lbl) throw new Error(`Invalid label: ${it?.label}`);
    return { commentId: String(it?.commentId), label: lbl };
  });
  return [{ items }];
}

export function normalizeToPages(rawInput: unknown): Array<z.infer<typeof AnalysisPage>> {
  // 0) If it's a JSON string, parse it early
  const parsedTop = tryJsonParse(rawInput);
  const top: any = parsedTop ?? rawInput;

  // 1) Common wrappers we've seen in MCP tools
  if (top && typeof top === 'object') {
    // { content: [{ type:"json", json: <payload> }, ...] }
    if ('content' in top && Array.isArray((top as any).content)) {
      const jsonPart = (top as any).content.find((p: any) => p && p.type === 'json' && p.json != null);
      if (jsonPart) return normalizeToPages(jsonPart.json);
    }
    // { arguments: "<json-string>" } or { arguments: <payload> }
    if ('arguments' in top) {
      const a = (top as any).arguments;
      const parsed = tryJsonParse(a);
      if (parsed != null) return normalizeToPages(parsed);
      return normalizeToPages(a);
    }
    // { data: <payload> } | { params: <payload> } | { input: <payload> }
    for (const k of ['data','params','input','body','json']) {
      if (k in top) return normalizeToPages((top as any)[k]);
    }
  }

  // 2) If there is an { analysis: ... } field, unwrap it
  const payload = (top && typeof top === 'object' && 'analysis' in top) ? (top as any).analysis : top;

  // 3) Direct interpretations first
  if (Array.isArray(payload)) {
    // Array of pages?
    if (payload.every(looksLikePage)) return payload as Array<z.infer<typeof AnalysisPage>>;
    // Array of items?
    if (payload.every(looksLikeItem)) return wrapItemsArrayAsPage(payload);
  }
  if (payload && typeof payload === 'object') {
    if (looksLikePage(payload)) {
      // Coerce labels to enum, ensure strings for ids
      const items = (payload.items as any[]).map((it) => {
        const lbl = coerceLabel(it.label);
        if (!lbl) throw new Error(`Invalid label: ${it.label}`);
        return { commentId: String(it.commentId), label: lbl };
      });
      return [{ items }];
    }
    // Some clients send { items: "<json-string>" }
    if ('items' in payload && typeof (payload as any).items === 'string') {
      const arr = tryJsonParse<any[]>((payload as any).items);
      if (Array.isArray(arr)) return wrapItemsArrayAsPage(arr);
    }
  }

  // 4) Deep search anywhere in the structure
  const candidates: any[] = [];
  for (const node of iterateNodes(payload)) {
    if (!node) continue;
    if (Array.isArray(node)) {
      if (node.every(looksLikePage)) { candidates.push(node); break; }
      if (node.every(looksLikeItem)) { candidates.push([{ items: node }]); break; }
      // Sometimes arrays contain a single wrapper object
      if (node.length === 1 && looksLikePage(node[0])) { candidates.push([node[0]]); break; }
    } else if (typeof node === 'object') {
      if (looksLikePage(node)) { candidates.push([node]); break; }
      if ('items' in node && Array.isArray((node as any).items)) {
        const arr = (node as any).items;
        if (arr.every(looksLikeItem)) { candidates.push([{ items: arr }]); break; }
        const parsed = typeof arr === 'string' ? tryJsonParse<any[]>(arr) : null;
        if (parsed && Array.isArray(parsed) && parsed.every(looksLikeItem)) {
          candidates.push([{ items: parsed }]); break;
        }
      }
    } else if (typeof node === 'string') {
      const parsed = tryJsonParse(node);
      if (parsed) {
        // try to interpret the parsed value immediately
        try {
          const res = normalizeToPages(parsed);
          if (res && res.length) return res;
        } catch { /* keep searching */ }
      }
    }
  }
  if (candidates.length) return candidates[0] as Array<z.infer<typeof AnalysisPage>>;

  // 5) Give a helpful error with a small preview
  const shapePreview = safeStringify(top);
  throw new Error(
    'summarize_sentiment: Could not normalize input. '
    + 'Expect {analysis:{items:[]}} | {items:[]} | array of pages | array of items. '
    + `shapePreview=${shapePreview}`
  );
}
