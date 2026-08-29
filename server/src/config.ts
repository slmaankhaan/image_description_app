interface BaseConfig {
  port: number;
  databasePath: string;
  uploadDir: string;
  maxFileSizeBytes: number;
}

export type Config = BaseConfig &
  ({ useFakeVision: true } | { useFakeVision: false; anthropicApiKey: string });

const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_PATH = 'data/app.db';
const DEFAULT_UPLOAD_DIR = 'data/uploads';
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const useFakeVision = env.USE_FAKE_VISION === 'true';
  const anthropicApiKey = env.ANTHROPIC_API_KEY;

  const base: BaseConfig = {
    port: Number(env.PORT) || DEFAULT_PORT,
    databasePath: env.DATABASE_PATH || DEFAULT_DATABASE_PATH,
    uploadDir: env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR,
    maxFileSizeBytes: Number(env.MAX_FILE_SIZE_BYTES) || DEFAULT_MAX_FILE_SIZE_BYTES,
  };

  if (useFakeVision) {
    return { ...base, useFakeVision: true };
  }

  if (!anthropicApiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY. Copy .env.example to .env and set your key, ' +
        'or set USE_FAKE_VISION=true in .env to run without one.'
    );
  }

  return { ...base, useFakeVision: false, anthropicApiKey };
}
