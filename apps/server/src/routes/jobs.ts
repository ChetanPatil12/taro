import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { asc, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { JobDefinition } from '@taro/shared';
import { schema } from '../db/index.js';
import { createTools } from '../mcp/tools.js';
import { ROOFING_PRESET, ROOFING_REGISTRY_SEED } from '../presets/roofing.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface PartyMessageBody {
  party_id: string;
  message: string;
  file?: { name: string; mime: string; data_base64: string };
}

/** REST API consumed by the web client. */
export function registerJobRoutes(app: FastifyInstance, filesDir: string): void {
  const db = app.db;
  const tools = createTools(db, app.hub);

  function insertJobFromDefinition(def: JobDefinition): string {
    const jobId = randomUUID();
    db.insert(schema.jobs)
      .values({ id: jobId, title: def.title, description: def.description })
      .run();
    const partyIdsByName = new Map<string, string>();
    for (const p of def.parties) {
      const id = randomUUID();
      partyIdsByName.set(p.name, id);
      db.insert(schema.parties)
        .values({
          id,
          jobId,
          name: p.name,
          role: p.role,
          channel: p.channel || 'chat',
          instructions: p.instructions,
        })
        .run();
    }
    def.steps.forEach((s, i) => {
      db.insert(schema.steps)
        .values({
          id: randomUUID(),
          jobId,
          sequenceNum: i + 1,
          title: s.title,
          description: s.description,
          requiredParties: s.requiredParties,
          dependsOn: s.dependsOn,
          conditions: s.conditions,
        })
        .run();
    });
    return jobId;
  }

  app.get('/api/jobs', async () => {
    const jobs = db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt)).all();
    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        createdAt: j.createdAt,
      })),
    };
  });

  app.post('/api/jobs', async (request, reply) => {
    const def = request.body as JobDefinition;
    if (!def?.title || !Array.isArray(def.parties) || def.parties.length === 0) {
      return reply.code(400).send({ error: 'title and at least one party are required' });
    }
    if (!Array.isArray(def.steps) || def.steps.length === 0) {
      return reply.code(400).send({ error: 'at least one step is required' });
    }
    const jobId = insertJobFromDefinition(def);
    try {
      await app.driver.startJob(jobId);
    } catch (err) {
      db.update(schema.jobs).set({ status: 'failed' }).where(eq(schema.jobs.id, jobId)).run();
      return reply
        .code(502)
        .send({ error: `agent session could not start: ${(err as Error).message}`, job_id: jobId });
    }
    return reply.code(201).send({ job_id: jobId });
  });

  app.post('/api/jobs/preset', async (_request, reply) => {
    const jobId = insertJobFromDefinition(ROOFING_PRESET);

    // Seed the cross-job commitment (dates relative to today so the
    // conflict always fires during the demo window).
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + ROOFING_REGISTRY_SEED.startOffsetDays);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + ROOFING_REGISTRY_SEED.durationDays - 1);
    // Idempotent seed: repeated demo loads must not accumulate duplicates.
    db.delete(schema.partyRegistry)
      .where(eq(schema.partyRegistry.jobId, ROOFING_REGISTRY_SEED.jobId))
      .run();
    db.insert(schema.partyRegistry)
      .values({
        id: randomUUID(),
        partyNameNormalized: ROOFING_REGISTRY_SEED.partyName.toLowerCase(),
        partyType: ROOFING_REGISTRY_SEED.partyType,
        jobId: ROOFING_REGISTRY_SEED.jobId,
        jobTitle: ROOFING_REGISTRY_SEED.jobTitle,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      })
      .run();

    try {
      await app.driver.startJob(jobId);
    } catch (err) {
      db.update(schema.jobs).set({ status: 'failed' }).where(eq(schema.jobs.id, jobId)).run();
      return reply
        .code(502)
        .send({ error: `agent session could not start: ${(err as Error).message}`, job_id: jobId });
    }
    return reply.code(201).send({ job_id: jobId });
  });

  app.get('/api/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    try {
      return tools.get_job_state({ job_id: jobId });
    } catch {
      return reply.code(404).send({ error: 'job not found' });
    }
  });

  app.get('/api/jobs/:jobId/log', async (request) => {
    const { jobId } = request.params as { jobId: string };
    const log = db
      .select()
      .from(schema.jobLog)
      .where(eq(schema.jobLog.jobId, jobId))
      .orderBy(asc(schema.jobLog.createdAt))
      .all();
    return { log };
  });

  app.patch('/api/jobs/:jobId/approve-plan', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
    if (!job) return reply.code(404).send({ error: 'job not found' });
    if (job.status !== 'awaiting_approval') {
      return reply.code(409).send({ error: `job is ${job.status}, not awaiting_approval` });
    }
    app.driver.approvePlan(jobId);
    return { status: 'active' };
  });

  app.post('/api/jobs/:jobId/message', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const body = request.body as PartyMessageBody;
    if (!body?.party_id || !body?.message) {
      return reply.code(400).send({ error: 'party_id and message are required' });
    }
    const party = db
      .select()
      .from(schema.parties)
      .where(eq(schema.parties.id, body.party_id))
      .get();
    if (!party || party.jobId !== jobId) {
      return reply.code(404).send({ error: 'party not found in this job' });
    }

    let fileNote = '';
    if (body.file) {
      const bytes = Buffer.from(body.file.data_base64, 'base64');
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return reply.code(413).send({ error: 'file too large (max 5MB)' });
      }
      mkdirSync(filesDir, { recursive: true });
      const fileId = randomUUID();
      // basename + charset allowlist: client filenames are untrusted and
      // must never influence the directory part of the path.
      const safeName = basename(body.file.name).replace(/[^\w.\- ]/g, '_') || 'upload';
      const path = join(filesDir, `${fileId}-${safeName}`);
      writeFileSync(path, bytes);
      db.insert(schema.files)
        .values({
          id: fileId,
          jobId,
          partyId: party.id,
          name: body.file.name,
          mime: body.file.mime,
          size: bytes.byteLength,
          path,
        })
        .run();
      fileNote = ` [attached file: ${body.file.name}]`;
    }

    // Record + broadcast the inbound message, then wake the agent.
    tools.post_party_message({
      job_id: jobId,
      party_id: party.id,
      direction: 'inbound',
      message: body.message + fileNote,
      message_type: body.file ? 'file' : 'chat',
    });
    app.driver.notifyPartyMessage(
      jobId,
      party.id,
      party.name,
      body.message,
      body.file
        ? { name: body.file.name, mime: body.file.mime, dataBase64: body.file.data_base64 }
        : undefined,
    );
    return { status: 'delivered' };
  });

  app.post('/api/jobs/:jobId/approvals/:approvalId', async (request, reply) => {
    const { jobId, approvalId } = request.params as { jobId: string; approvalId: string };
    const body = request.body as { decision: 'approved' | 'rejected'; reason?: string };
    if (body?.decision !== 'approved' && body?.decision !== 'rejected') {
      return reply.code(400).send({ error: "decision must be 'approved' or 'rejected'" });
    }
    try {
      app.driver.decideApproval(jobId, approvalId, body.decision, body.reason);
    } catch (err) {
      return reply.code(409).send({ error: (err as Error).message });
    }
    return { status: 'recorded', decision: body.decision };
  });

  app.get('/api/jobs/:jobId/artifacts', async (request) => {
    const { jobId } = request.params as { jobId: string };
    const rows = db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.jobId, jobId))
      .orderBy(desc(schema.artifacts.createdAt))
      .all();
    return {
      artifacts: rows.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        version: a.version,
        ready: !a.path.startsWith('pending:') && !a.path.startsWith('failed:'),
        createdAt: a.createdAt,
      })),
    };
  });

  app.get('/api/artifacts/:artifactId/download', async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const artifact = db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, artifactId))
      .get();
    if (!artifact || artifact.path.startsWith('pending:') || !existsSync(artifact.path)) {
      return reply.code(404).send({ error: 'artifact not available' });
    }
    reply.header('content-disposition', `attachment; filename="${artifact.name}"`);
    return reply.send(createReadStream(artifact.path));
  });
}
