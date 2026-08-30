import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Bring-your-own-key gate for the hosted demo.
 *
 * Reading is open to everyone; anything that costs model tokens (creating
 * jobs, messaging parties, deciding approvals) requires an unlock: the
 * visitor submits THEIR OpenAI key, we validate it against OpenAI, hand it
 * to TrueForge's model provider, and issue a session token. Keys are held
 * only in TrueForge's provider config — never written to Taro's database
 * or logs.
 */
export class UnlockGate {
  private readonly tokens = new Set<string>();

  constructor(
    private readonly enabled: boolean,
    private readonly trueforgeUrl: string,
  ) {}

  get required(): boolean {
    return this.enabled;
  }

  isUnlocked(request: FastifyRequest): boolean {
    if (!this.enabled) return true;
    const token = request.headers['x-taro-token'];
    return typeof token === 'string' && this.tokens.has(token);
  }

  /** preHandler-style guard for write routes. Returns true if blocked. */
  block(request: FastifyRequest, reply: FastifyReply): boolean {
    if (this.isUnlocked(request)) return false;
    void reply.code(401).send({ error: 'locked', hint: 'unlock with your OpenAI API key' });
    return true;
  }

  async unlock(apiKey: string): Promise<string> {
    const probe = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!probe.ok) {
      throw new Error(
        probe.status === 401
          ? 'That API key was rejected by OpenAI.'
          : `OpenAI check failed (HTTP ${probe.status}).`,
      );
    }

    // Rotate the key into TrueForge's model provider for this deployment.
    const res = await fetch(`${this.trueforgeUrl}/api/v1/settings/model-providers`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        manifest: {
          type: 'openai',
          auth: { api_key: apiKey },
          models: [
            {
              model_id: 'gpt-5.1',
              name: 'gpt-5-1',
              properties: { context_length: 400000, max_output_tokens: 128000 },
            },
            {
              model_id: 'gpt-5-mini',
              name: 'gpt-5-mini',
              properties: { context_length: 400000, max_output_tokens: 128000 },
            },
          ],
        },
      }),
    });
    if (!res.ok)
      throw new Error(`Could not register the key with the harness (HTTP ${res.status}).`);

    const token = `${randomUUID()}${randomUUID()}`;
    this.tokens.add(token);
    return token;
  }
}

export function registerUnlockRoutes(app: FastifyInstance, gate: UnlockGate): void {
  app.get('/api/unlock/status', async (request) => ({
    required: gate.required,
    unlocked: gate.isUnlocked(request),
  }));

  app.post('/api/unlock', async (request, reply) => {
    const body = request.body as { api_key?: string };
    const key = body?.api_key?.trim();
    if (!key || !key.startsWith('sk-')) {
      return reply.code(400).send({ error: 'Provide an OpenAI API key (starts with sk-).' });
    }
    try {
      const token = await gate.unlock(key);
      return { token };
    } catch (err) {
      return reply.code(401).send({ error: (err as Error).message });
    }
  });
}
