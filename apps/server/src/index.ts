import { TrueForge } from '@truefoundry/trueforge-sdk';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { JobDriver } from './trueforge/driver.js';
import { ensureTaroMcpServer } from './trueforge/ensure.js';
import { ensureAgents } from './trueforge/orchestrator.js';

const config = loadConfig();
const db = createDb(config.databasePath);
const client = new TrueForge({ baseUrl: config.trueforgeUrl });

const app = await buildApp({
  db,
  filesDir: config.filesDir,
  logger: true,
  mcpSharedSecret: config.mcpSharedSecret,
  requireUnlock: config.requireUnlock,
  trueforgeUrl: config.trueforgeUrl,
  webDist: config.webDist,
  makeDriver: (hub) => new JobDriver(db, hub, client, config.trueforgeUrl, config.artifactsDir),
});

async function registerWithTrueForge(): Promise<boolean> {
  try {
    const mcpUrl = process.env.MCP_PUBLIC_URL ?? `http://localhost:${config.port}/mcp`;
    await ensureTaroMcpServer(config.trueforgeUrl, mcpUrl, config.mcpSharedSecret);
    await ensureAgents(client, config.orchestratorModel, config.plannerModel);
    app.log.info('taro MCP server + planner/orchestrator agents registered with TrueForge');
    return true;
  } catch (err) {
    app.log.warn(
      { err },
      'TrueForge registration failed — retrying every 15s until it is reachable.',
    );
    return false;
  }
}

if (!(await registerWithTrueForge())) {
  const retry = setInterval(() => {
    void registerWithTrueForge().then((ok) => {
      if (ok) clearInterval(retry);
    });
  }, 15_000);
  retry.unref();
}

app.listen({ port: config.port, host: config.host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
