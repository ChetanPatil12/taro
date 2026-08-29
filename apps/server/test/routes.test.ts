import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import type { JobDriver } from '../src/trueforge/driver.js';

class StubDriver {
  calls: Array<{ method: string; args: unknown[] }> = [];
  async startJob(...args: unknown[]) {
    this.calls.push({ method: 'startJob', args });
  }
  approvePlan(...args: unknown[]) {
    this.calls.push({ method: 'approvePlan', args });
  }
  notifyPartyMessage(...args: unknown[]) {
    this.calls.push({ method: 'notifyPartyMessage', args });
  }
  decideApproval(...args: unknown[]) {
    this.calls.push({ method: 'decideApproval', args });
  }
}

describe('REST API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let driver: StubDriver;

  beforeEach(async () => {
    driver = new StubDriver();
    app = await buildApp({
      db: createDb(':memory:'),
      makeDriver: () => driver as unknown as JobDriver,
      filesDir: '/tmp/taro-test-files',
    });
  });

  it('rejects a job without parties or steps', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: { title: 'X', description: 'Y', parties: [], steps: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a job from a definition and starts the driver', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        title: 'Test job',
        description: 'desc',
        parties: [{ name: 'Alice', role: 'owner', channel: 'chat', instructions: '' }],
        steps: [
          {
            title: 'Step 1',
            description: '',
            requiredParties: ['Alice'],
            dependsOn: [],
            conditions: '',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const { job_id } = res.json();
    expect(driver.calls).toEqual([{ method: 'startJob', args: [job_id] }]);

    const state = await app.inject({ method: 'GET', url: `/api/jobs/${job_id}` });
    expect(state.json().parties).toHaveLength(1);
    expect(state.json().steps).toHaveLength(1);
  });

  it('loads the roofing preset and seeds the cross-job registry', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    expect(res.statusCode).toBe(201);
    const { job_id } = res.json();

    const state = await app.inject({ method: 'GET', url: `/api/jobs/${job_id}` });
    expect(state.json().parties).toHaveLength(4);
    expect(state.json().steps).toHaveLength(8);

    // The seed lives in party_registry — verify through the DB.
    const rows = app.db
      .select()
      .from((await import('../src/db/index.js')).schema.partyRegistry)
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.partyNameNormalized).toBe("bob's roofing");
  });

  it('refuses plan approval unless awaiting_approval', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    const { job_id } = create.json();
    const res = await app.inject({ method: 'PATCH', url: `/api/jobs/${job_id}/approve-plan` });
    expect(res.statusCode).toBe(409);
  });

  it('records a party message and wakes the driver', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    const { job_id } = create.json();
    const state = await app.inject({ method: 'GET', url: `/api/jobs/${job_id}` });
    const sarah = state.json().parties.find((p: { name: string }) => p.name === 'Sarah Chen');

    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${job_id}/message`,
      payload: { party_id: sarah.id, message: 'I am free Thursday' },
    });
    expect(res.statusCode).toBe(200);
    const wake = driver.calls.find((c) => c.method === 'notifyPartyMessage');
    expect(wake?.args[3]).toBe('I am free Thursday');

    const log = await app.inject({ method: 'GET', url: `/api/jobs/${job_id}/log` });
    expect(log.json().log.some((e: { message: string }) => e.message.includes('Thursday'))).toBe(
      true,
    );
  });

  it('loads the preset twice without duplicating registry commitments', async () => {
    await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    const rows = app.db
      .select()
      .from((await import('../src/db/index.js')).schema.partyRegistry)
      .all();
    expect(rows).toHaveLength(1);
  });

  it('stores uploads under filesDir even for traversal filenames', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    const { job_id } = create.json();
    const state = await app.inject({ method: 'GET', url: `/api/jobs/${job_id}` });
    const sarah = state.json().parties.find((p: { name: string }) => p.name === 'Sarah Chen');

    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${job_id}/message`,
      payload: {
        party_id: sarah.id,
        message: 'file attached',
        file: {
          name: '../../../../tmp/evil.txt',
          mime: 'text/plain',
          data_base64: Buffer.from('x').toString('base64'),
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const files = app.db
      .select()
      .from((await import('../src/db/index.js')).schema.files)
      .all();
    expect(files).toHaveLength(1);
    expect(files[0]?.path.startsWith('/tmp/taro-test-files/')).toBe(true);
    expect(files[0]?.path.includes('..')).toBe(false);
  });

  it('validates approval decisions', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/jobs/preset' });
    const { job_id } = create.json();
    const res = await app.inject({
      method: 'POST',
      url: `/api/jobs/${job_id}/approvals/nonexistent`,
      payload: { decision: 'maybe' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s on unknown artifacts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/artifacts/nope/download' });
    expect(res.statusCode).toBe(404);
  });
});
