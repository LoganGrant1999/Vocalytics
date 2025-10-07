import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  FetchCommentsArgsSchema,
  AnalyzeCommentsArgsSchema,
  GenerateRepliesArgsSchema,
  SummarizeSentimentArgsSchema,
} from './schemas.js';
import {
  fetchComments,
  analyzeComments,
  generateReplies,
  summarizeSentiment,
} from './tools.js';

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

export function registerTools(server: Server) {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'fetch_comments',
          description:
            'Use this when the user wants to retrieve recent YouTube comments for a specific video or the whole channel if no video is specified. Do not use when the user is asking for analysis, sentiment, or reply drafting—use analyze_comments or generate_replies instead.',
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
                description: 'Maximum number of comments to fetch (max 50)',
                maximum: 50,
                default: 50,
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
          description:
            'Use this when the user wants comment classification or sentiment (positive/neutral/constructive/negative/spam). Do not use to fetch new comments or to draft replies—use fetch_comments or generate_replies instead.',
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
                    channelId: { type: 'string' },
                    authorDisplayName: { type: 'string' },
                    authorChannelId: { type: 'string' },
                    textDisplay: { type: 'string' },
                    textOriginal: { type: 'string' },
                    likeCount: { type: 'number' },
                    publishedAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                  required: [
                    'id',
                    'videoId',
                    'channelId',
                    'authorDisplayName',
                    'authorChannelId',
                    'textDisplay',
                    'textOriginal',
                    'likeCount',
                    'publishedAt',
                    'updatedAt',
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
          description:
            'Use this when the user wants 1–3 reply suggestions for a single comment in selected tones. Do not use for bulk analysis or summaries—use analyze_comments or summarize_sentiment.',
          inputSchema: {
            type: 'object',
            properties: {
              comment: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  videoId: { type: 'string' },
                  channelId: { type: 'string' },
                  authorDisplayName: { type: 'string' },
                  authorChannelId: { type: 'string' },
                  textDisplay: { type: 'string' },
                  textOriginal: { type: 'string' },
                  likeCount: { type: 'number' },
                  publishedAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: [
                  'id',
                  'videoId',
                  'channelId',
                  'authorDisplayName',
                  'authorChannelId',
                  'textDisplay',
                  'textOriginal',
                  'likeCount',
                  'publishedAt',
                  'updatedAt',
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
          description:
            'Use this when the user wants an overall sentiment roll-up, highlights, or a brief summary of themes from prior analysis. Do not use to fetch data or to generate per-comment replies—use fetch_comments or generate_replies.',
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

    switch (name) {
      case 'fetch_comments': {
        const validated = FetchCommentsArgsSchema.parse(args);
        const comments = await fetchComments(
          validated.videoId,
          validated.channelId,
          validated.max
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary: `Fetched ${comments.length} comment(s)`,
                  count: comments.length,
                },
                null,
                2
              ),
            },
          ],
          _meta: {
            fullData: comments,
          },
        };
      }

      case 'analyze_comments': {
        const validated = AnalyzeCommentsArgsSchema.parse(args);
        const analysis = await analyzeComments(validated.comments);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary: `Analyzed ${analysis.length} comment(s)`,
                  count: analysis.length,
                },
                null,
                2
              ),
            },
          ],
          _meta: {
            fullData: analysis,
          },
        };
      }

      case 'generate_replies': {
        const validated = GenerateRepliesArgsSchema.parse(args);
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
        const validated = SummarizeSentimentArgsSchema.parse(args);
        const summary = await summarizeSentiment(validated.analysis);

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
