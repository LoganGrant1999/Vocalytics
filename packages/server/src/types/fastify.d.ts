// packages/server/src/types/fastify.d.ts
import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email?: string; tier?: "free" | "pro" };
    auth?: { userId: string; userDbId?: string; email?: string; tier?: "free" | "pro" | null };
  }
}
