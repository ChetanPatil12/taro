import Fastify from 'fastify';

/**
 * Builds the Fastify instance. Kept separate from the listen() call so tests
 * can exercise routes with app.inject() without binding a port.
 */
export function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  app.get('/api/health', async () => ({ status: 'ok', service: 'taro-server' }));

  return app;
}
