// Vercel serverless function entry point for /api
// Use the AWS Lambda adapter for Fastify
import awsLambdaFastify from '@fastify/aws-lambda';
import { createHttpServer } from '../packages/server/src/http/index.js';

let handler: any;

export default async function (req: any, res: any) {
  if (!handler) {
    const app = await createHttpServer();
    handler = awsLambdaFastify(app);
  }
  return handler(req, res);
}
