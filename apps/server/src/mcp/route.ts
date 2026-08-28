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
export function registerMcpRoute(app: FastifyInstance): void {
  const tools = createTools(app.db, app.hub);

  app.post('/mcp', async (request, reply) => {
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
