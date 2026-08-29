import multipart from '@fastify/multipart';
import fastify, { type FastifyInstance } from 'fastify';
import type { ImageRepository } from './db/images';
import { registerErrorHandling } from './error-handler';
import { registerImageRoutes } from './routes/images';
import type { VisionClient } from './vision/types';

declare module 'fastify' {
  interface FastifyInstance {
    // In-flight fire-and-forget description tasks, keyed by their own
    // promise. Tests await these to observe the pending -> ready/failed
    // transition deterministically instead of sleeping an arbitrary amount.
    pendingDescriptions: Set<Promise<void>>;
  }
}

export interface AppDeps {
  imageRepository: ImageRepository;
  visionClient: VisionClient;
  uploadDir: string;
  maxFileSizeBytes: number;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = fastify();

  app.decorate('pendingDescriptions', new Set<Promise<void>>());

  registerErrorHandling(app);

  app.register(multipart, {
    limits: { fileSize: deps.maxFileSizeBytes },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  registerImageRoutes(app, {
    imageRepository: deps.imageRepository,
    visionClient: deps.visionClient,
    uploadDir: deps.uploadDir,
  });

  return app;
}
