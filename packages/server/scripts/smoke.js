import fs from "node:fs";
import path from "node:path";
// Adjust these imports if your export names differ
import { fetchCommentsTool, analyzeCommentsTool, summarizeSentimentTool, generateRepliesTool } from "../src/tools";
function section(t) { console.log("\n" + "—".repeat(80)); console.log(t); console.log("—".repeat(80)); }
const fixturePath = path.join(__dirname, "..", "fixtures", "comments.json");
(async () => {
    // F2: Fetch (live) — only runs if env is set
    section("F2 FETCH_COMMENTS (Live YouTube: optional)");
    const VIDEO_ID = process.env.TW_TEST_VIDEO_ID || "";
    const CHANNEL_ID = process.env.TW_TEST_CHANNEL_ID || "";
    if (VIDEO_ID || CHANNEL_ID) {
        const out = await fetchCommentsTool({
            videoId: VIDEO_ID || undefined,
            channelId: CHANNEL_ID || undefined,
            includeReplies: true,
            order: "time",
            max: 10
        });
        if (!Array.isArray(out.comments))
            throw new Error("comments should be array");
        if (!out.comments.every((c) => typeof c.id === "string" && typeof c.text === "string")) {
            throw new Error("comment shape invalid");
        }
        console.log(`Fetched ${out.comments.length} comments ✅`);
        if (out.nextPageToken)
            console.log("Pagination token present ✅");
    }
    else {
        console.log("Skipped (set TW_TEST_VIDEO_ID or TW_TEST_CHANNEL_ID to run)");
    }
    // F3: Analyze (fixture)
    section("F3 ANALYZE_COMMENTS (Fixture)");
    const comments = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const analysis = await analyzeCommentsTool({ comments });
    const cats = new Set(analysis.map(a => a.category));
    const expected = ["positive", "neutral", "constructive", "negative", "spam"];
    if (expected.filter(c => cats.has(c)).length < 3)
        throw new Error("Expected ≥3 categories from fixture");
    console.log("Categories look diverse ✅");
    // F5: Summarize
    section("F5 SUMMARIZE_SENTIMENT");
    const summary = await summarizeSentimentTool({ analysis });
    const total = analysis.length;
    const sum = (summary.counts?.positive ?? 0) +
        (summary.counts?.neutral ?? 0) +
        (summary.counts?.constructive ?? 0) +
        (summary.counts?.negative ?? 0) +
        (summary.counts?.spam ?? 0);
    if (sum !== total)
        throw new Error("aggregate counts != total");
    if (typeof summary.toxicityLevel !== "string")
        throw new Error("toxicityLevel missing");
    console.log("Summaries consistent & toxicityLevel present ✅");
    // F4: Replies (mock)
    section("F4 GENERATE_REPLIES (Mock)");
    const mock = comments[0];
    const replies = await generateRepliesTool({ comment: mock, tones: ["friendly", "concise", "enthusiastic"] });
    if (!Array.isArray(replies.fullData) || replies.fullData.length === 0)
        throw new Error("no replies generated");
    const hasFriendly = replies.fullData.some((r) => r.tone === "friendly" && typeof r.reply === "string" && r.reply.trim());
    const hasConcise = replies.fullData.some((r) => r.tone === "concise" && typeof r.reply === "string" && r.reply.trim());
    if (!hasFriendly || !hasConcise)
        throw new Error("missing expected tones/reply text");
    console.log("Replies generated for expected tones ✅");
    console.log("\nALL SMOKE TESTS PASSED ✅");
})().catch(e => { console.error(e); process.exit(1); });
