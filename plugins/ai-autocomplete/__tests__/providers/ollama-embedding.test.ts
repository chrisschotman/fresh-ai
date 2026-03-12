import { ollamaEmbeddingProvider } from '../../providers/ollama-embedding';
import type { EmbeddingRequest, ProviderConfig } from '../../providers/types';

const request: EmbeddingRequest = {
  input: ['function add(a: number, b: number)'],
  model: 'nomic-embed-text',
};

const config: ProviderConfig = {
  endpoint: 'http://localhost:11434/api/embed',
  model: 'nomic-embed-text',
  apiKeyEnv: 'NONE',
};

describe('ollamaEmbeddingProvider', () => {
  it('has correct name and defaults', () => {
    expect(ollamaEmbeddingProvider.name).toBe('ollama');
    expect(ollamaEmbeddingProvider.defaultModel).toBe('nomic-embed-text');
    expect(ollamaEmbeddingProvider.defaultEndpoint).toBe('http://localhost:11434/api/embed');
  });

  describe('buildShellCommand', () => {
    it('includes curl with correct flags', () => {
      const cmd = ollamaEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('curl --silent --show-error --max-time 30');
      expect(cmd).toContain('-X POST');
    });

    it('does not include auth header', () => {
      const cmd = ollamaEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).not.toContain('Authorization');
      expect(cmd).not.toContain('x-api-key');
    });

    it('includes shell-escaped endpoint', () => {
      const cmd = ollamaEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain("'http://localhost:11434/api/embed'");
    });

    it('includes model and input in body', () => {
      const cmd = ollamaEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('nomic-embed-text');
      expect(cmd).toContain('function add');
    });

    it('sends array input for batch requests', () => {
      const batchRequest: EmbeddingRequest = {
        input: ['text one', 'text two'],
        model: 'nomic-embed-text',
      };
      const cmd = ollamaEmbeddingProvider.buildShellCommand(batchRequest, config);

      expect(cmd).toContain('text one');
      expect(cmd).toContain('text two');
    });
  });

  describe('parseResponse', () => {
    it('parses single embedding response', () => {
      const stdout = JSON.stringify({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      const result = ollamaEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({ embeddings: [[0.1, 0.2, 0.3]] });
    });

    it('parses batch embedding response', () => {
      const stdout = JSON.stringify({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      });

      const result = ollamaEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      });
    });

    it('returns null for missing embeddings', () => {
      expect(ollamaEmbeddingProvider.parseResponse(JSON.stringify({}))).toBeNull();
    });

    it('returns null for bad items in batch instead of failing entire batch', () => {
      const stdout = JSON.stringify({
        embeddings: [[0.1, 0.2], []],
      });

      const result = ollamaEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({
        embeddings: [[0.1, 0.2], null],
      });
    });

    it('returns null for invalid JSON', () => {
      expect(ollamaEmbeddingProvider.parseResponse('{{{')).toBeNull();
    });
  });
});
