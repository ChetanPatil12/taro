import Fastify from 'fastify';
import type { TaroDb } from './db/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: TaroDb;
  }
}

export interface BuildAppOptions {
  db: TaroDb;
  logger?: boolean;
}

/**
 * Builds the Fastify instance. Kept separate from the listen() call so tests
 * can exercise routes with app.inject() without binding a port.
 */
export function buildApp(opts: BuildAppOptions) {
  const app = Fastify({ logger: opts.logger ?? false });

  app.decorate('db', opts.db);

  app.get('/api/health', async () => ({ status: 'ok', service: 'taro-server' }));

  return app;
}
