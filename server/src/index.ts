import { buildApp } from './app';
import type { Config } from './config';
import { loadConfig } from './config';
import { openDb } from './db';
import { ImageRepository } from './db/images';
import { createVisionClient } from './vision';

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const config = loadConfigOrExit();

const db = openDb(config.databasePath);
const imageRepository = new ImageRepository(db);
const visionClient = createVisionClient(config);

const app = buildApp({
  imageRepository,
  visionClient,
  uploadDir: config.uploadDir,
  maxFileSizeBytes: config.maxFileSizeBytes,
});

app.listen({ port: config.port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
