export class VisionServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VisionServiceError';
  }
}

/**
 * Implementations must catch SDK/network failures and throw
 * VisionServiceError rather than letting the underlying error escape —
 * callers rely on that to distinguish a vision failure from a programming
 * error, and the contract isn't visible from the method signature alone.
 */
export interface VisionClient {
  describe(input: { imageBase64: string; mimeType: string }): Promise<string>;
}
