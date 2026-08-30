import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load env files explicitly rather than via `dotenv/config`: workspace
// scripts run with apps/server as cwd, so a cwd-relative lookup would skip
// the repository-root .env documented by .env.example. A server-local .env
// takes precedence over the root one; real process env vars always win
// (dotenv never overrides variables that are already set).
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: [resolve(here, '../.env'), resolve(here, '../../../.env')] });

export interface ServerConfig {
  port: number;
  /** Bind address. Defaults to loopback; set HOST=0.0.0.0 only behind a proxy. */
  host: string;
  databasePath: string;
  trueforgeUrl: string;
  orchestratorModel: string;
  artifactsDir: string;
  filesDir: string;
  mcpSharedSecret: string | undefined;
  requireUnlock: boolean;
  webDist: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8000),
    host: env.HOST ?? '127.0.0.1',
    databasePath: env.DATABASE_PATH ?? './data/taro.db',
    trueforgeUrl: env.TRUEFORGE_URL ?? 'http://localhost:8790',
    orchestratorModel: env.ORCHESTRATOR_MODEL ?? 'openai/gpt-5-1',
    artifactsDir: env.ARTIFACTS_DIR ?? './data/artifacts',
    filesDir: env.FILES_DIR ?? './data/files',
    mcpSharedSecret: env.MCP_SHARED_SECRET || undefined,
    requireUnlock: env.REQUIRE_UNLOCK === 'true' || env.REQUIRE_UNLOCK === '1',
    webDist: env.WEB_DIST || undefined,
  };
}
