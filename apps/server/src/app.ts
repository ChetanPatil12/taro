import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { TaroDb } from './db/index.js';
import { registerMcpRoute } from './mcp/route.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerUnlockRoutes, UnlockGate } from './routes/unlock.js';
import type { JobDriver } from './trueforge/driver.js';
import { WsHub } from './ws/hub.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: TaroDb;
    hub: WsHub;
    driver: JobDriver;
  }
}

export interface BuildAppOptions {
  db: TaroDb;
  /** Factory so the driver can capture the hub the app creates. */
  makeDriver: (hub: WsHub) => JobDriver;
  /** Require this bearer token on /mcp (TrueForge header auth). */
  mcpSharedSecret?: string;
  /** Hosted demo: gate write actions behind a visitor-supplied OpenAI key. */
  requireUnlock?: boolean;
  trueforgeUrl?: string;
  filesDir?: string;
  /** Absolute or cwd-relative path to the built web app; served when present. */
  webDist?: string;
  logger?: boolean;
}

/**
 * Builds the Fastify instance. Kept separate from the listen() call so tests
 * can exercise routes with app.inject() without binding a port.
 */
export async function buildApp(opts: BuildAppOptions) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 12 * 1024 * 1024 });

  const hub = new WsHub();
  app.decorate('db', opts.db);
  app.decorate('hub', hub);
  app.decorate('driver', opts.makeDriver(hub));

  await app.register(websocket);

  app.get('/api/health', async () => {
    // "live" must mean the HARNESS is reachable, not just this process.
    let trueforge: boolean;
    try {
      const res = await fetch(
        `${opts.trueforgeUrl ?? 'http://localhost:8790'}/api/v1/capabilities`,
        { signal: AbortSignal.timeout(1500) },
      );
      trueforge = res.ok;
    } catch {
      trueforge = false;
    }
    return { status: 'ok', service: 'taro-server', trueforge };
  });

  // Live event stream, one connection per watched job.
  app.get('/ws/:jobId', { websocket: true }, (socket, req) => {
    const { jobId } = req.params as { jobId: string };
    app.hub.register(jobId, socket);
  });

  const gate = new UnlockGate(
    opts.requireUnlock ?? false,
    opts.trueforgeUrl ?? 'http://localhost:8790',
  );
  registerMcpRoute(app, opts.mcpSharedSecret);
  registerUnlockRoutes(app, gate);
  registerJobRoutes(app, opts.filesDir ?? './data/files', gate);

  // Hosted mode: serve the built SPA from the same process.
  const dist = opts.webDist ? resolve(opts.webDist) : null;
  if (dist && existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api') || request.raw.url?.startsWith('/mcp')) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
