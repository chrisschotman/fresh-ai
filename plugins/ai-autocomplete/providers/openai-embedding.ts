import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResponse, ProviderConfig } from './types';
import { shellEscape } from '../bridge';

interface OpenAIEmbeddingResponseItem {
  embedding?: number[];
  index?: number;
}

interface OpenAIEmbeddingResponse {
  data?: OpenAIEmbeddingResponseItem[];
}

export const openaiEmbeddingProvider: EmbeddingProvider = {
  name: 'openai-compatible',
  defaultEndpoint: 'https://api.openai.com/v1/embeddings',
  defaultModel: 'text-embedding-3-small',

  buildShellCommand(request: EmbeddingRequest, config: ProviderConfig): string {
    const body = JSON.stringify({
      input: request.input,
      model: request.model,
    });

    return [
      'curl --silent --show-error --max-time 30',
      '-X POST',
      "-H 'Content-Type: application/json'",
      `-H "Authorization: Bearer $${config.apiKeyEnv}"`,
      `-d ${shellEscape(body)}`,
      shellEscape(config.endpoint),
    ].join(' ');
  },

  parseResponse(stdout: string): EmbeddingResponse | null {
    try {
      const json = JSON.parse(stdout) as OpenAIEmbeddingResponse;
      if (!Array.isArray(json.data) || json.data.length === 0) return null;

      // Sort by index to ensure correct order
      const sorted = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      const embeddings: (number[] | null)[] = [];
      for (const item of sorted) {
        if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
          embeddings.push(null);
        } else {
          embeddings.push(item.embedding);
        }
      }

      return { embeddings };
    } catch {
      return null;
    }
  },
};
