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
  databasePath: string;
  trueforgeUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8000),
    databasePath: env.DATABASE_PATH ?? './data/taro.db',
    trueforgeUrl: env.TRUEFORGE_URL ?? 'http://localhost:8790',
  };
}
