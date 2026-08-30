import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import { createDb, schema } from '../src/db/index.js';
import type { TaroDb } from '../src/db/index.js';
import { JobDriver } from '../src/trueforge/driver.js';
import { WsHub } from '../src/ws/hub.js';

class FakeClient {
  turns: unknown[][] = [];
  sessions = {
    create: async () => ({ data: { id: 'session-1' } }),
    createTurnStream: async (_sid: string, opts: { input: unknown[] }) => {
      this.turns.push(opts.input);
      return (async function* () {})();
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('JobDriver approval batching', () => {
  let db: TaroDb;
  let driver: JobDriver;
  let client: FakeClient;
  let jobId: string;

  beforeEach(() => {
    db = createDb(':memory:');
    client = new FakeClient();
    driver = new JobDriver(
      db,
      new WsHub(),
      client as unknown as TrueForge,
      'http://localhost:8790',
      '/tmp/taro-test-artifacts',
    );
    jobId = randomUUID();
    db.insert(schema.jobs)
      .values({
        id: jobId,
        title: 'T',
        description: 'D',
        status: 'paused',
        trueforgeSessionId: 'session-1',
      })
      .run();
    for (const call of ['call_a', 'call_b']) {
      db.insert(schema.approvals)
        .values({
          id: randomUUID(),
          jobId,
          toolCallId: call,
          threadId: 'main',
          actionType: 'confirm_date',
          description: `gate ${call}`,
        })
        .run();
    }
  });

  it('waits for every pending gate, then resumes with one combined turn', async () => {
    const [first, second] = db.select().from(schema.approvals).all();

    driver.decideApproval(jobId, first!.id, 'approved');
    await flush();
    expect(client.turns).toHaveLength(0); // second gate still undecided

    driver.decideApproval(jobId, second!.id, 'rejected', 'not yet');
    await flush();
    expect(client.turns).toHaveLength(1);
    const input = client.turns[0] as Array<{ type: string; toolCallId: string }>;
    expect(input).toHaveLength(2);
    expect(input.map((i) => i.type)).toEqual(['user.tool_approval', 'user.tool_approval']);
    expect(new Set(input.map((i) => i.toolCallId))).toEqual(new Set(['call_a', 'call_b']));

    const rows = db.select().from(schema.approvals).all();
    expect(rows.every((r) => r.resumed === 1)).toBe(true);
  });

  it('rejects double decisions', async () => {
    const [first, second] = db.select().from(schema.approvals).all();
    driver.decideApproval(jobId, first!.id, 'approved');
    expect(() => driver.decideApproval(jobId, first!.id, 'approved')).toThrow(/already decided/);
    driver.decideApproval(jobId, second!.id, 'approved');
    await flush();
    expect(client.turns).toHaveLength(1); // decisions sent exactly once
  });
});
