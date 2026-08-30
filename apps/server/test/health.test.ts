import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import type { JobDriver } from '../src/trueforge/driver.js';

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const app = await buildApp({
      db: createDb(':memory:'),
      makeDriver: () => ({}) as JobDriver,
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: 'ok', service: 'taro-server' });
    expect(typeof body.trueforge).toBe('boolean'); // reflects harness reachability
    await app.close();
  });
});

describe('POST /mcp auth', () => {
  it('rejects requests without the shared secret when one is configured', async () => {
    const app = await buildApp({
      db: createDb(':memory:'),
      makeDriver: () => ({}) as JobDriver,
      mcpSharedSecret: 's3cret',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
