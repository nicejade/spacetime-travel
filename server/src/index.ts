import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`spacetime-travel API listening on http://localhost:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
