import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { TaroDb } from './db/index.js';
import { registerMcpRoute } from './mcp/route.js';
import { WsHub } from './ws/hub.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: TaroDb;
    hub: WsHub;
  }
}

export interface BuildAppOptions {
  db: TaroDb;
  /** Require this bearer token on /mcp (TrueForge header auth). */
  mcpSharedSecret?: string;
  logger?: boolean;
}

/**
 * Builds the Fastify instance. Kept separate from the listen() call so tests
 * can exercise routes with app.inject() without binding a port.
 */
export async function buildApp(opts: BuildAppOptions) {
  const app = Fastify({ logger: opts.logger ?? false });

  app.decorate('db', opts.db);
  app.decorate('hub', new WsHub());

  await app.register(websocket);

  app.get('/api/health', async () => ({ status: 'ok', service: 'taro-server' }));

  // Live event stream, one connection per watched job.
  app.get('/ws/:jobId', { websocket: true }, (socket, req) => {
    const { jobId } = req.params as { jobId: string };
    app.hub.register(jobId, socket);
  });

  registerMcpRoute(app, opts.mcpSharedSecret);

  return app;
}
