import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FetchCommentsArgsSchema, AnalyzeCommentsArgsSchema, GenerateRepliesArgsSchema, SummarizeSentimentArgsSchema, normalizeToPages, AnalysisPage, } from './schemas.js';
import { fetchComments, analyzeComments, generateReplies, summarizeSentiment, } from './tools.js';
const YOUTUBE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
// Security schemes for OAuth2
const securitySchemes = {
    youtube_oauth: {
        type: 'oauth2',
        flows: {
            authorizationCode: {
                authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                scopes: {
                    [YOUTUBE_OAUTH_SCOPE]: 'Read YouTube data',
                },
            },
        },
    },
};
export function registerTools(server) {
    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: 'fetch_comments',
                    description: 'Use this when the user wants to retrieve recent YouTube comments for a specific video or the whole channel if no video is specified. Do not use when the user is asking for analysis, sentiment, or reply drafting—use analyze_comments or generate_replies instead.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            videoId: {
                                type: 'string',
                                description: 'YouTube video ID',
                            },
                            channelId: {
                                type: 'string',
                                description: 'YouTube channel ID',
                            },
                            max: {
                                type: 'number',
                                description: 'Maximum number of comments to fetch (max 100)',
                                maximum: 100,
                                default: 50,
                            },
                            pageToken: {
                                type: 'string',
                                description: 'YouTube pageToken',
                            },
                            includeReplies: {
                                type: 'boolean',
                                description: 'Include replies',
                                default: false,
                            },
                            order: {
                                type: 'string',
                                enum: ['time', 'relevance'],
                                default: 'time',
                            },
                        },
                    },
                    security: [{ youtube_oauth: [YOUTUBE_OAUTH_SCOPE] }],
                    _meta: {
                        securitySchemes,
                        'openai/toolInvocation': {
                            invoking: 'Fetching YouTube comments...',
                            invoked: 'Comments fetched successfully',
                        },
                    },
                    annotations: {
                        readOnlyHint: true,
                    },
                },
                {
                    name: 'analyze_comments',
                    description: 'Use this when the user wants comment classification or sentiment (positive/neutral/constructive/negative/spam). Do not use to fetch new comments or to draft replies—use fetch_comments or generate_replies instead.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            comments: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        videoId: { type: 'string' },
                                        author: { type: 'string' },
                                        text: { type: 'string' },
                                        publishedAt: { type: 'string' },
                                        likeCount: { type: 'number' },
                                        replyCount: { type: 'number' },
                                        isReply: { type: 'boolean' },
                                        parentId: { type: 'string' },
                                    },
                                    required: [
                                        'id',
                                        'videoId',
                                        'author',
                                        'text',
                                        'publishedAt',
                                        'likeCount',
                                        'replyCount',
                                        'isReply',
                                    ],
                                },
                                description: 'Array of comments to analyze',
                            },
                        },
                        required: ['comments'],
                    },
                    _meta: {
                        securitySchemes,
                        'openai/toolInvocation': {
                            invoking: 'Analyzing comments...',
                            invoked: 'Analysis complete',
                        },
                    },
                    annotations: {
                        readOnlyHint: true,
                    },
                },
                {
                    name: 'generate_replies',
                    description: 'Use this when the user wants 1–3 reply suggestions for a single comment in selected tones. Do not use for bulk analysis or summaries—use analyze_comments or summarize_sentiment.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            comment: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    videoId: { type: 'string' },
                                    author: { type: 'string' },
                                    text: { type: 'string' },
                                    publishedAt: { type: 'string' },
                                    likeCount: { type: 'number' },
                                    replyCount: { type: 'number' },
                                    isReply: { type: 'boolean' },
                                    parentId: { type: 'string' },
                                },
                                required: [
                                    'id',
                                    'videoId',
                                    'author',
                                    'text',
                                    'publishedAt',
                                    'likeCount',
                                    'replyCount',
                                    'isReply',
                                ],
                                description: 'The comment to reply to',
                            },
                            tones: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['friendly', 'concise', 'enthusiastic'],
                                },
                                description: 'Tones for generated replies',
                            },
                        },
                        required: ['comment', 'tones'],
                    },
                    _meta: {
                        securitySchemes,
                        'openai/outputTemplate': 'ui://widget/tw-replies.html',
                        'openai/toolInvocation': {
                            invoking: 'Generating replies...',
                            invoked: 'Replies generated',
                        },
                    },
                    annotations: {
                        readOnlyHint: true,
                    },
                },
                {
                    name: 'summarize_sentiment',
                    description: 'Use this when the user wants an overall sentiment roll-up, highlights, or a brief summary of themes from prior analysis. Do not use to fetch data or to generate per-comment replies—use fetch_comments or generate_replies.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            analysis: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        commentId: { type: 'string' },
                                        sentiment: {
                                            type: 'object',
                                            properties: {
                                                positive: { type: 'number' },
                                                negative: { type: 'number' },
                                                neutral: { type: 'number' },
                                            },
                                            required: ['positive', 'negative', 'neutral'],
                                        },
                                        topics: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                        intent: { type: 'string' },
                                        toxicity: { type: 'number' },
                                    },
                                    required: ['commentId', 'sentiment', 'topics', 'intent', 'toxicity'],
                                },
                                description: 'Array of comment analyses',
                            },
                        },
                        required: ['analysis'],
                    },
                    _meta: {
                        securitySchemes,
                        'openai/outputTemplate': 'ui://widget/tw-summary.html',
                        'openai/toolInvocation': {
                            invoking: 'Summarizing sentiment...',
                            invoked: 'Summary complete',
                        },
                    },
                    annotations: {
                        readOnlyHint: true,
                    },
                },
            ],
            _meta: {
                securitySchemes,
            },
        };
    });
    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        // --- shared tiny helpers ---
        function maybeParseJSON(x) {
            if (typeof x === "string" && x.trim().startsWith("{")) {
                try {
                    return JSON.parse(x);
                }
                catch {
                    return null;
                }
            }
            return null;
        }
        function sanitizeFetchArgs(a) {
            if (!a)
                return a;
            // If the entire arguments is a JSON string
            const parsedAll = maybeParseJSON(a);
            if (parsedAll)
                a = parsedAll;
            // If videoId/channelId were pasted as JSON blobs, extract fields
            const vParsed = maybeParseJSON(a.videoId);
            if (vParsed && typeof vParsed.videoId === "string")
                a.videoId = vParsed.videoId;
            const cParsed = maybeParseJSON(a.channelId);
            if (cParsed && typeof cParsed.channelId === "string")
                a.channelId = cParsed.channelId;
            return a;
        }
        switch (name) {
            case 'fetch_comments': {
                try {
                    const validated = FetchCommentsArgsSchema.parse(sanitizeFetchArgs(args));
                    const result = await fetchComments(validated.videoId, validated.channelId, validated.max, validated.pageToken, validated.includeReplies, validated.order);
                    return {
                        content: [{ type: 'text', text: `Fetched ${result.comments.length} comment(s)` }],
                        structuredContent: {
                            count: result.comments.length,
                            comments: result.comments,
                            nextPageToken: result.nextPageToken
                        },
                        _meta: { fullData: result.comments },
                    };
                }
                catch (e) {
                    const msg = e?.message || 'Unknown error';
                    // Map YouTube API errors to standard codes
                    let httpStatus = 500;
                    let code = 'INTERNAL';
                    if (/YouTube API error 401/.test(msg)) {
                        httpStatus = 401;
                        code = 'UNAUTHENTICATED';
                    }
                    else if (/YouTube API error 403/.test(msg)) {
                        // Check for rate limit reasons
                        if (/quotaExceeded|userRateLimitExceeded|rateLimitExceeded/i.test(msg)) {
                            httpStatus = 429;
                            code = 'RESOURCE_EXHAUSTED';
                        }
                        else {
                            httpStatus = 403;
                            code = 'PERMISSION_DENIED';
                        }
                    }
                    else if (/YouTube API error 404|video not found|private/i.test(msg)) {
                        httpStatus = 404;
                        code = 'NOT_FOUND';
                    }
                    else if (/YouTube API error 5\d\d/.test(msg)) {
                        httpStatus = 503;
                        code = 'UNAVAILABLE';
                    }
                    else if (/YouTube API error 400/.test(msg)) {
                        httpStatus = 400;
                        code = 'INVALID_ARGUMENT';
                    }
                    else if (/Provide videoId or channelId/.test(msg)) {
                        httpStatus = 400;
                        code = 'INVALID_ARGUMENT';
                    }
                    else if (/Validation failed/.test(msg) || e?.name === 'ZodError') {
                        httpStatus = 400;
                        code = 'INVALID_ARGUMENT';
                    }
                    return {
                        content: [{ type: 'text', text: `fetch_comments failed: ${msg}` }],
                        _meta: {
                            error: {
                                code,
                                message: msg,
                                httpStatus,
                                ...(e?.issues && { details: e.issues })
                            }
                        },
                    };
                }
            }
            case 'analyze_comments': {
                const validated = AnalyzeCommentsArgsSchema.parse(args);
                const analysis = await analyzeComments(validated.comments);
                function labelFor(text) {
                    const t = (text || "").toLowerCase();
                    // spam
                    if (/(https?:\/\/|www\.|visit my channel|free i?phone|giveaway|promo code)/.test(t))
                        return "spam";
                    // constructive cues (questions, polite disagreement)
                    if (/\?|not sure|don['']?t|dont|disagree|could you|clarify|maybe|suggest|consider/.test(t))
                        return "constructive";
                    // negative
                    if (/hate|terrible|awful|worst|trash|scam|fake/.test(t))
                        return "negative";
                    // positive
                    if (/love|loved|great|helpful|amazing|awesome|thanks|thank you|appreciate/.test(t))
                        return "positive";
                    return "neutral";
                }
                // Create lookup map from commentId to text
                const commentTextMap = new Map(validated.comments.map(c => [c.id, c.text]));
                // Build minimal items for structuredContent
                const items = analysis.map(a => ({
                    commentId: a.commentId,
                    label: labelFor(commentTextMap.get(a.commentId) || "")
                }));
                // Calculate aggregates
                const aggregates = items.reduce((acc, item) => {
                    const label = item.label;
                    acc[label]++;
                    acc.total++;
                    return acc;
                }, { positive: 0, neutral: 0, constructive: 0, negative: 0, spam: 0, total: 0 });
                return {
                    content: [{ type: 'text', text: `Analyzed ${items.length} comment(s)` }],
                    structuredContent: {
                        items,
                        aggregates
                    },
                    _meta: {
                        fullData: analysis,
                    },
                };
            }
            case 'generate_replies': {
                function normalizeArgs(a) {
                    if (!a)
                        return a;
                    // If user pasted full payload into 'comment' field by mistake:
                    if (a.comment && a.comment.comment) {
                        a.comment = a.comment.comment;
                    }
                    // If tones got nested under comment by mistake:
                    if (a.comment && a.comment.tones && !a.tones) {
                        a.tones = a.comment.tones;
                        delete a.comment.tones;
                    }
                    return a;
                }
                const validated = GenerateRepliesArgsSchema.parse(normalizeArgs(args));
                const replies = await generateReplies(validated.comment, validated.tones);
                return {
                    content: [
                        {
                            type: 'resource',
                            resource: {
                                uri: 'ui://widget/tw-replies.html',
                                mimeType: 'text/html+skybridge',
                                text: JSON.stringify(replies),
                            },
                        },
                    ],
                    _meta: {
                        fullData: replies,
                    },
                };
            }
            case 'summarize_sentiment': {
                // Be maximally tolerant of input shapes, then validate pages with Zod.
                const anyInput = SummarizeSentimentArgsSchema.parse(args);
                const pagesAny = normalizeToPages(anyInput);
                // Validate each page structurally; this will throw helpful errors if malformed.
                const pages = pagesAny.map((p) => AnalysisPage.parse(p));
                // Flatten all items from all pages into a single analysis array
                const allItems = pages.flatMap(page => page.items);
                // Convert items to Analysis format for summarizeSentiment
                const analysisData = allItems.map(item => ({
                    commentId: item.commentId,
                    sentiment: {
                        positive: item.label === 'positive' ? 0.8 : 0.1,
                        negative: item.label === 'negative' ? 0.8 : 0.1,
                        neutral: item.label === 'neutral' ? 0.8 : 0.1,
                    },
                    topics: [],
                    intent: item.label,
                    toxicity: item.label === 'spam' ? 0.9 : 0.1,
                    category: item.label,
                }));
                const summary = await summarizeSentiment(analysisData);
                return {
                    content: [
                        {
                            type: 'resource',
                            resource: {
                                uri: 'ui://widget/tw-summary.html',
                                mimeType: 'text/html+skybridge',
                                text: JSON.stringify(summary),
                            },
                        },
                    ],
                    _meta: {
                        fullData: summary,
                    },
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    });
}
