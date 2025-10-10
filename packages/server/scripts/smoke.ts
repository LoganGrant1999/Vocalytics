import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pick a function from a module by trying several possible export names
function pick<T = any>(obj: any, names: string[], kind = "function"): T {
  for (const n of names) {
    const v = obj[n];
    if ((kind === "function" && typeof v === "function") || (kind === "object" && v && typeof v === "object")) {
      return v as T;
    }
  }
  throw new Error(`Missing export. Tried: ${names.join(", ")}`);
}

function section(t: string) {
  console.log("\n" + "—".repeat(80));
  console.log(t);
  console.log("—".repeat(80));
}

const fixturePath = path.join(__dirname, "..", "fixtures", "comments.json");

// Helpers to tolerate differing tool arg/return shapes
async function callAnalyze(analyzeFn: any, commentsArr: any[]): Promise<any[]> {
  const attempts: any[] = [
    commentsArr,                        // bare array
    { comments: commentsArr },
    { items: commentsArr },
    { data: commentsArr },
    { payload: commentsArr },
    { commentsJson: JSON.stringify(commentsArr) }
  ];
  for (const args of attempts) {
    try {
      const res: any = await analyzeFn(args as any);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.analysis)) return res.analysis;
    } catch {
      // Try next shape
    }
  }
  throw new Error("analyze_comments: none of the argument shapes worked");
}

async function callSummarize(summarizeFn: any, analysisArr: any[]): Promise<any> {
  const attempts: any[] = [
    analysisArr,                        // bare array
    { analysis: analysisArr },
    { items: analysisArr },
    { data: analysisArr },
    { payload: analysisArr }
  ];
  for (const args of attempts) {
    try {
      const res: any = await summarizeFn(args as any);
      if (res?.counts && typeof res?.toxicityLevel === "string") return res;
    } catch {
      // Try next shape
    }
  }
  throw new Error("summarize_sentiment: none of the argument shapes worked");
}

async function callGenerateReplies(generateFn: any, comment: any, tones: string[]): Promise<any> {
  const attempts = [
    { comment, tones },
    { input: { comment, tones } },
    { data: { comment, tones } }
  ];
  for (const args of attempts) {
    try {
      const res: any = await generateFn(args as any);
      if (Array.isArray(res?.fullData) || Array.isArray(res)) return res;
    } catch (_) { /* next */ }
  }
  throw new Error("generate_replies: none of the argument shapes worked");
}

(async () => {
  const Tools = await import("../src/tools");

  // Try common naming variants for each tool
  const fetchCommentsTool = pick(Tools, ["fetchCommentsTool","fetch_comments","fetchComments","fetchCommentsHandler"]);
  const analyzeCommentsTool = pick(Tools, ["analyzeCommentsTool","analyze_comments","analyzeComments"]);
  const summarizeSentimentTool = pick(Tools, ["summarizeSentimentTool","summarize_sentiment","summarizeSentiment"]);
  const generateRepliesTool = pick(Tools, ["generateRepliesTool","generate_replies","generateReplies"]);

  // F2: Fetch (live) — only runs if env is set
  section("F2 FETCH_COMMENTS (Live YouTube: optional)");
  const VIDEO_ID = process.env.TW_TEST_VIDEO_ID || "";
  const CHANNEL_ID = process.env.TW_TEST_CHANNEL_ID || "";
  if (VIDEO_ID || CHANNEL_ID) {
    const out: any = await fetchCommentsTool({
      videoId: VIDEO_ID || undefined,
      channelId: CHANNEL_ID || undefined,
      includeReplies: true,
      order: "time",
      max: 10
    });
    if (!Array.isArray(out.comments)) throw new Error("comments should be array");
    if (!out.comments.every((c: any) => typeof c.id === "string" && typeof c.text === "string")) {
      console.log("Available keys on first comment:", Object.keys(out.comments[0] ?? {}));
      throw new Error("comment shape invalid (must include id, text)");
    }
    console.log(`Fetched ${out.comments.length} comments ✅`);
    if (out.nextPageToken) console.log("Pagination token present ✅");
  } else {
    console.log("Skipped (set TW_TEST_VIDEO_ID or TW_TEST_CHANNEL_ID to run)");
  }

  // F3: Analyze (fixture)
  section("F3 ANALYZE_COMMENTS (Fixture)");
  const comments = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  if (!Array.isArray(comments)) { throw new Error("Fixture did not parse to an array"); }
  const analysis: any[] = await callAnalyze(analyzeCommentsTool, comments);
  const cats = new Set(analysis.map((a: any) => a.category));
  const expected = ["positive", "neutral", "constructive", "negative", "spam"];
  if (expected.filter((c) => cats.has(c)).length < 3) throw new Error("Expected ≥3 categories from fixture");
  console.log("Categories look diverse ✅");

  // F5: Summarize
  section("F5 SUMMARIZE_SENTIMENT");
  const summary: any = await callSummarize(summarizeSentimentTool, analysis);
  const total = analysis.length;
  const sum =
    (summary.counts?.positive ?? 0) +
    (summary.counts?.neutral ?? 0) +
    (summary.counts?.constructive ?? 0) +
    (summary.counts?.negative ?? 0) +
    (summary.counts?.spam ?? 0);
  if (sum !== total) throw new Error("aggregate counts != total");
  if (typeof summary.toxicityLevel !== "string") throw new Error("toxicityLevel missing");
  console.log("Summaries consistent & toxicityLevel present ✅");

  // F4: Replies (mock)
  section("F4 GENERATE_REPLIES (Mock)");
  const mock = comments[0];
  const replies: any = await callGenerateReplies(generateRepliesTool, mock, ["friendly", "concise", "enthusiastic"]);
  const rows = Array.isArray(replies?.fullData) ? replies.fullData : replies;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("no replies generated");
  const hasFriendly = rows.some((r: any) => r.tone === "friendly" && typeof r.reply === "string" && r.reply.trim());
  const hasConcise  = rows.some((r: any) => r.tone === "concise"  && typeof r.reply === "string" && r.reply.trim());
  if (!hasFriendly || !hasConcise) throw new Error("missing expected tones/reply text");
  console.log("Replies generated for expected tones ✅");

  console.log("\nALL SMOKE TESTS PASSED ✅");
})().catch((e) => {
  console.error(e);
  import("../src/tools").then((m) => console.error("tools exports:", Object.keys(m)));
  process.exit(1);
});
