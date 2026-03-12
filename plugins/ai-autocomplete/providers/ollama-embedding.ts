import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResponse, ProviderConfig } from './types';
import { shellEscape } from '../bridge';

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

export const ollamaEmbeddingProvider: EmbeddingProvider = {
  name: 'ollama',
  defaultEndpoint: 'http://localhost:11434/api/embed',
  defaultModel: 'nomic-embed-text',

  buildShellCommand(request: EmbeddingRequest, config: ProviderConfig): string {
    const body = JSON.stringify({
      model: request.model,
      input: request.input,
    });

    return [
      'curl --silent --show-error --max-time 30',
      '-X POST',
      "-H 'Content-Type: application/json'",
      `-d ${shellEscape(body)}`,
      shellEscape(config.endpoint),
    ].join(' ');
  },

  parseResponse(stdout: string): EmbeddingResponse | null {
    try {
      const json = JSON.parse(stdout) as OllamaEmbedResponse;
      if (!Array.isArray(json.embeddings) || json.embeddings.length === 0) return null;

      const embeddings: (number[] | null)[] = [];
      for (const emb of json.embeddings) {
        if (!Array.isArray(emb) || emb.length === 0) {
          embeddings.push(null);
        } else {
          embeddings.push(emb);
        }
      }

      return { embeddings };
    } catch {
      return null;
    }
  },
};
