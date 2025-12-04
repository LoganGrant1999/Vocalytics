/**
 * Vercel Serverless Function - Catch-all API handler
 * Routes all /api/* requests to the Fastify HTTP server
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import awsLambdaFastify from '@fastify/aws-lambda';

// Cache the handler across invocations
let cachedHandler: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Fastify server and wrap it for serverless
    if (!cachedHandler) {
      const { createHttpServer } = await import('../packages/server/src/http/index.js');
      const fastify = await createHttpServer();
      cachedHandler = awsLambdaFastify(fastify);
    }

    // Convert Vercel request to AWS Lambda format
    const event = {
      httpMethod: req.method,
      path: req.url,
      headers: req.headers as Record<string, string>,
      body: JSON.stringify(req.body),
      queryStringParameters: req.query as Record<string, string>,
      isBase64Encoded: false,
    };

    const context = {};

    // Call the Lambda handler
    const response = await cachedHandler(event, context);

    // Convert Lambda response back to Vercel format
    res.status(response.statusCode);

    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }

    res.send(response.body);
  } catch (error: any) {
    console.error('[Vercel Handler Error]:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  }
}
