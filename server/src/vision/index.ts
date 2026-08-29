import type { Config } from '../config';
import { createAnthropicVisionClient } from './anthropic-client';
import { createFakeVisionClient } from './fake-client';
import type { VisionClient } from './types';

export function createVisionClient(config: Config): VisionClient {
  if (config.useFakeVision) {
    return createFakeVisionClient();
  }

  return createAnthropicVisionClient(config.anthropicApiKey);
}
