import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerResources(server: Server) {
  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'ui://widget/tw-summary.html',
          mimeType: 'text/html+skybridge',
          name: 'Vocalytics Summary Widget',
          _meta: {
            'openai/widgetDescription':
              'Displays sentiment analysis summary for YouTube comments',
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
          name: 'Vocalytics Replies Widget',
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
}
