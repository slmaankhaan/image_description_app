import Anthropic from '@anthropic-ai/sdk';
import { VisionServiceError, type VisionClient } from './types';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 300;
const PROMPT =
  'Describe this image in 2-3 sentences. Cover the main subject, the ' +
  'setting, and any notable details. Respond with plain prose only — no ' +
  'markdown, no headings, no bullet points, no preamble.';

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

function assertSupportedMimeType(mimeType: string): asserts mimeType is SupportedMimeType {
  if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
    throw new VisionServiceError(`Unsupported image MIME type: ${mimeType}`);
  }
}

export function createAnthropicVisionClient(apiKey: string): VisionClient {
  const client = new Anthropic({ apiKey });

  return {
    async describe({ imageBase64, mimeType }): Promise<string> {
      assertSupportedMimeType(mimeType);

      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: imageBase64,
                  },
                },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
        });

        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );

        if (!textBlock?.text.trim()) {
          throw new VisionServiceError('Vision response contained no text content.');
        }

        return textBlock.text;
      } catch (error) {
        if (error instanceof VisionServiceError) {
          throw error;
        }
        throw new VisionServiceError('Vision request failed.', { cause: error });
      }
    },
  };
}
