/**
 * Idempotent TrueForge setup performed at server startup: registers (or
 * refreshes) the `taro` MCP server pointing at this process, carrying the
 * shared secret as a bearer header when one is configured.
 */
export async function ensureTaroMcpServer(
  trueforgeUrl: string,
  mcpUrl: string,
  sharedSecret?: string,
): Promise<void> {
  const manifest: Record<string, unknown> = {
    type: 'remote',
    name: 'taro',
    url: mcpUrl,
    description:
      'Taro coordination platform tools: job state, party messaging, steps, ' +
      'conflicts, gated decisions, cross-job registry, artifacts',
  };
  if (sharedSecret) {
    manifest.auth = { type: 'header', headers: { authorization: `Bearer ${sharedSecret}` } };
  }
  const res = await fetch(`${trueforgeUrl}/api/v1/settings/mcp-servers`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifest }),
  });
  if (!res.ok) {
    throw new Error(`MCP server registration failed: HTTP ${res.status} ${await res.text()}`);
  }
}
