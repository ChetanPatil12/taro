import { TrueForge } from '@truefoundry/trueforge-sdk';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { JobDriver } from './trueforge/driver.js';
import { ensureTaroMcpServer } from './trueforge/ensure.js';
import { ensureOrchestratorAgent } from './trueforge/orchestrator.js';

const config = loadConfig();
const db = createDb(config.databasePath);
const client = new TrueForge({ baseUrl: config.trueforgeUrl });

const app = await buildApp({
  db,
  filesDir: config.filesDir,
  logger: true,
  mcpSharedSecret: config.mcpSharedSecret,
  makeDriver: (hub) => new JobDriver(db, hub, client, config.trueforgeUrl, config.artifactsDir),
});

try {
  const mcpUrl = process.env.MCP_PUBLIC_URL ?? `http://localhost:${config.port}/mcp`;
  await ensureTaroMcpServer(config.trueforgeUrl, mcpUrl, config.mcpSharedSecret);
  await ensureOrchestratorAgent(client, config.orchestratorModel);
  app.log.info('taro MCP server + orchestrator agent registered with TrueForge');
} catch (err) {
  app.log.warn(
    { err },
    'could not register orchestrator agent — is TrueForge running? Jobs will fail to start until it is.',
  );
}

app.listen({ port: config.port, host: config.host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
