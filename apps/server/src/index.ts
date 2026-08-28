import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';

const config = loadConfig();
const db = createDb(config.databasePath);
const app = await buildApp({ db, logger: true, mcpSharedSecret: config.mcpSharedSecret });

app.listen({ port: config.port, host: config.host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
