import { VisionServiceError, type VisionClient } from './types';

export interface FakeVisionClientOptions {
  description?: string;
  shouldFail?: boolean;
  delayMs?: number;
}

const DEFAULT_DESCRIPTION = 'A fake description used for local development and tests.';

export function createFakeVisionClient(options: FakeVisionClientOptions = {}): VisionClient {
  const { description = DEFAULT_DESCRIPTION, shouldFail = false, delayMs = 0 } = options;

  return {
    async describe(): Promise<string> {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (shouldFail) {
        throw new VisionServiceError('Fake vision client configured to fail.');
      }
      return description;
    },
  };
}
