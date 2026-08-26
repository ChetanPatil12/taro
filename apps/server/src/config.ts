import 'dotenv/config';

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
