/**
 * Vercel Serverless Function - Stripe Webhook Handler
 * Must handle raw body for signature verification
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import awsLambdaFastify from '@fastify/aws-lambda';

// Disable body parsing to get raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

// Cache the handler across invocations
let cachedHandler: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Fastify server and wrap it for serverless
    if (!cachedHandler) {
      const { createHttpServer } = await import('../../packages/server/src/http/index.js');
      const fastify = await createHttpServer();
      cachedHandler = awsLambdaFastify(fastify);
    }

    // Read raw body for webhook signature verification
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const bodyString = Buffer.concat(chunks).toString('utf8');

    // Convert Vercel request to AWS Lambda format
    const event = {
      httpMethod: req.method,
      path: '/webhook/stripe',
      headers: req.headers as Record<string, string>,
      body: bodyString,
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
    console.error('[Webhook Handler Error]:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  }
}
