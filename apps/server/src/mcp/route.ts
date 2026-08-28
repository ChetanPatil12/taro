import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { createTools } from './tools.js';
import { buildMcpServer } from './server.js';

/**
 * Mounts the Taro MCP endpoint at POST /mcp (stateless streamable HTTP).
 * TrueForge registers this URL as a remote MCP server; every agent tool call
 * lands here and executes against the same SQLite + WebSocket hub as the
 * REST API.
 */
export function registerMcpRoute(app: FastifyInstance, sharedSecret?: string): void {
  const tools = createTools(app.db, app.hub);

  app.post('/mcp', async (request, reply) => {
    // When a shared secret is configured, require it as a bearer token —
    // TrueForge sends it via the MCP server's header-auth setting. Without
    // a secret, the localhost bind is the trust boundary (local demo mode).
    if (sharedSecret && request.headers.authorization !== `Bearer ${sharedSecret}`) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const server = buildMcpServer(tools);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });
}
