import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
import { createHealthServer } from './health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const YOUTUBE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const server = new Server(
  {
    name: 'tubewhisperer',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

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

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'ui://widget/tw-summary.html',
        mimeType: 'text/html+skybridge',
        name: 'TubeWhisperer Summary Widget',
        _meta: {
          'openai/widgetDescription': 'Displays sentiment analysis summary for YouTube comments',
          'openai/widgetPrefersBorder': true,
          'openai/widgetCSP': {
            connect_domains: [],
            resource_domains: ['https://persistent.oaistatic.com'],
          },
        },
      },
      {
        uri: 'ui://widget/tw-replies.html',
        mimeType: 'text/html+skybridge',
        name: 'TubeWhisperer Replies Widget',
        _meta: {
          'openai/widgetDescription': 'Displays generated replies for YouTube comments',
          'openai/widgetPrefersBorder': true,
          'openai/widgetCSP': {
            connect_domains: [],
            resource_domains: ['https://persistent.oaistatic.com'],
          },
        },
      },
    ],
  };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Load the web bundle
  let webBundle = '';
  try {
    const webBundlePath = join(__dirname, '../../web/dist/bundle.js');
    webBundle = await readFile(webBundlePath, 'utf-8');
  } catch {
    webBundle = '// Web bundle not found - run pnpm build';
  }

  if (uri === 'ui://widget/tw-summary.html') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
    .summary { display: grid; gap: 12px; }
    .metric { background: #f5f5f5; padding: 12px; border-radius: 8px; }
    .metric-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .metric-value { font-size: 24px; font-weight: 600; }
    .topics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .topic { background: #e3f2fd; padding: 4px 12px; border-radius: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
${webBundle}
  </script>
</body>
</html>`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/html+skybridge',
          text: html,
        },
      ],
    };
  }

  if (uri === 'ui://widget/tw-replies.html') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; }
    .replies { display: grid; gap: 16px; }
    .reply { background: #f5f5f5; padding: 16px; border-radius: 8px; }
    .tone-badge { display: inline-block; background: #2196f3; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
    .reply-text { line-height: 1.5; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
${webBundle}
  </script>
</body>
</html>`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/html+skybridge',
          text: html,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

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

async function main() {
  const PORT = Number(process.env.PORT || 3000);
  const health = createHealthServer('1.0.0');
  await health.listen({ port: PORT, host: '0.0.0.0' });
  console.error(`[health] http://localhost:${PORT}/health`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TubeWhisperer MCP server running on stdio');
}

main().catch(console.error);
