import { z } from 'zod';
export const ToneEnum = z.enum(['friendly', 'concise', 'enthusiastic']);
export const CommentSchema = z.object({
    id: z.string(),
    videoId: z.string(),
    channelId: z.string(),
    authorDisplayName: z.string(),
    authorChannelId: z.string(),
    textDisplay: z.string(),
    textOriginal: z.string(),
    likeCount: z.number(),
    publishedAt: z.string(),
    updatedAt: z.string(),
});
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
    videoId: z.string().optional(),
    channelId: z.string().optional(),
    max: z.number().int().min(1).max(50).default(20),
});
export const AnalyzeCommentsArgsSchema = z.object({
    comments: z.array(CommentSchema),
});
export const GenerateRepliesArgsSchema = z.object({
    comment: CommentSchema,
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
function safeStringify(v, max = 800) {
    try {
        const s = JSON.stringify(v);
        return s.length > max ? s.slice(0, max) + "…" : s;
    }
    catch {
        return String(v);
    }
}
function tryJsonParse(v) {
    if (typeof v === 'string') {
        try {
            return JSON.parse(v);
        }
        catch {
            return null;
        }
    }
    return null;
}
function looksLikePage(v) {
    return v && typeof v === 'object' && Array.isArray(v.items);
}
function looksLikeItem(v) {
    return v && typeof v === 'object' && typeof v.commentId === 'string' && typeof v.label === 'string';
}
function coerceLabel(label) {
    const L = label;
    return ['positive', 'neutral', 'constructive', 'negative', 'spam'].includes(L) ? L : null;
}
// Breadth-first deep search for useful shapes anywhere in the payload.
function* iterateNodes(root, maxDepth = 6) {
    const q = [{ v: root, d: 0 }];
    const seen = new Set();
    while (q.length) {
        const { v, d } = q.shift();
        if (v && typeof v === 'object') {
            if (seen.has(v))
                continue;
            seen.add(v);
        }
        yield v;
        if (d >= maxDepth)
            continue;
        if (Array.isArray(v)) {
            for (const el of v)
                q.push({ v: el, d: d + 1 });
        }
        else if (v && typeof v === 'object') {
            for (const k of Object.keys(v))
                q.push({ v: v[k], d: d + 1 });
        }
        else if (typeof v === 'string') {
            const parsed = tryJsonParse(v);
            if (parsed != null)
                q.push({ v: parsed, d: d + 1 });
        }
    }
}
function wrapItemsArrayAsPage(arr) {
    const items = arr.map((it) => {
        const lbl = coerceLabel(it?.label);
        if (!lbl)
            throw new Error(`Invalid label: ${it?.label}`);
        return { commentId: String(it?.commentId), label: lbl };
    });
    return [{ items }];
}
export function normalizeToPages(rawInput) {
    // 0) If it's a JSON string, parse it early
    const parsedTop = tryJsonParse(rawInput);
    const top = parsedTop ?? rawInput;
    // 1) Common wrappers we've seen in MCP tools
    if (top && typeof top === 'object') {
        // { content: [{ type:"json", json: <payload> }, ...] }
        if ('content' in top && Array.isArray(top.content)) {
            const jsonPart = top.content.find((p) => p && p.type === 'json' && p.json != null);
            if (jsonPart)
                return normalizeToPages(jsonPart.json);
        }
        // { arguments: "<json-string>" } or { arguments: <payload> }
        if ('arguments' in top) {
            const a = top.arguments;
            const parsed = tryJsonParse(a);
            if (parsed != null)
                return normalizeToPages(parsed);
            return normalizeToPages(a);
        }
        // { data: <payload> } | { params: <payload> } | { input: <payload> }
        for (const k of ['data', 'params', 'input', 'body', 'json']) {
            if (k in top)
                return normalizeToPages(top[k]);
        }
    }
    // 2) If there is an { analysis: ... } field, unwrap it
    const payload = (top && typeof top === 'object' && 'analysis' in top) ? top.analysis : top;
    // 3) Direct interpretations first
    if (Array.isArray(payload)) {
        // Array of pages?
        if (payload.every(looksLikePage))
            return payload;
        // Array of items?
        if (payload.every(looksLikeItem))
            return wrapItemsArrayAsPage(payload);
    }
    if (payload && typeof payload === 'object') {
        if (looksLikePage(payload)) {
            // Coerce labels to enum, ensure strings for ids
            const items = payload.items.map((it) => {
                const lbl = coerceLabel(it.label);
                if (!lbl)
                    throw new Error(`Invalid label: ${it.label}`);
                return { commentId: String(it.commentId), label: lbl };
            });
            return [{ items }];
        }
        // Some clients send { items: "<json-string>" }
        if ('items' in payload && typeof payload.items === 'string') {
            const arr = tryJsonParse(payload.items);
            if (Array.isArray(arr))
                return wrapItemsArrayAsPage(arr);
        }
    }
    // 4) Deep search anywhere in the structure
    const candidates = [];
    for (const node of iterateNodes(payload)) {
        if (!node)
            continue;
        if (Array.isArray(node)) {
            if (node.every(looksLikePage)) {
                candidates.push(node);
                break;
            }
            if (node.every(looksLikeItem)) {
                candidates.push([{ items: node }]);
                break;
            }
            // Sometimes arrays contain a single wrapper object
            if (node.length === 1 && looksLikePage(node[0])) {
                candidates.push([node[0]]);
                break;
            }
        }
        else if (typeof node === 'object') {
            if (looksLikePage(node)) {
                candidates.push([node]);
                break;
            }
            if ('items' in node && Array.isArray(node.items)) {
                const arr = node.items;
                if (arr.every(looksLikeItem)) {
                    candidates.push([{ items: arr }]);
                    break;
                }
                const parsed = typeof arr === 'string' ? tryJsonParse(arr) : null;
                if (parsed && Array.isArray(parsed) && parsed.every(looksLikeItem)) {
                    candidates.push([{ items: parsed }]);
                    break;
                }
            }
        }
        else if (typeof node === 'string') {
            const parsed = tryJsonParse(node);
            if (parsed) {
                // try to interpret the parsed value immediately
                try {
                    const res = normalizeToPages(parsed);
                    if (res && res.length)
                        return res;
                }
                catch { /* keep searching */ }
            }
        }
    }
    if (candidates.length)
        return candidates[0];
    // 5) Give a helpful error with a small preview
    const shapePreview = safeStringify(top);
    throw new Error('summarize_sentiment: Could not normalize input. '
        + 'Expect {analysis:{items:[]}} | {items:[]} | array of pages | array of items. '
        + `shapePreview=${shapePreview}`);
}
