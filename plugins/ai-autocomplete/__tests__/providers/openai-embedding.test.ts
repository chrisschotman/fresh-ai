import { openaiEmbeddingProvider } from '../../providers/openai-embedding';
import type { EmbeddingRequest, ProviderConfig } from '../../providers/types';

const request: EmbeddingRequest = {
  input: ['function add(a: number, b: number)'],
  model: 'text-embedding-3-small',
};

const config: ProviderConfig = {
  endpoint: 'https://api.openai.com/v1/embeddings',
  model: 'text-embedding-3-small',
  apiKeyEnv: 'OPENAI_API_KEY',
};

describe('openaiEmbeddingProvider', () => {
  it('has correct name and defaults', () => {
    expect(openaiEmbeddingProvider.name).toBe('openai-compatible');
    expect(openaiEmbeddingProvider.defaultModel).toBe('text-embedding-3-small');
    expect(openaiEmbeddingProvider.defaultEndpoint).toBe('https://api.openai.com/v1/embeddings');
  });

  describe('buildShellCommand', () => {
    it('includes curl with correct flags', () => {
      const cmd = openaiEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('curl --silent --show-error --max-time 30');
      expect(cmd).toContain('-X POST');
    });

    it('includes Bearer auth header with env var', () => {
      const cmd = openaiEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('Authorization: Bearer $OPENAI_API_KEY');
    });

    it('includes shell-escaped body and endpoint', () => {
      const cmd = openaiEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('-d ');
      expect(cmd).toContain("'https://api.openai.com/v1/embeddings'");
    });

    it('includes model and input in body', () => {
      const cmd = openaiEmbeddingProvider.buildShellCommand(request, config);

      expect(cmd).toContain('text-embedding-3-small');
      expect(cmd).toContain('function add');
    });

    it('sends array input for batch requests', () => {
      const batchRequest: EmbeddingRequest = {
        input: ['text one', 'text two'],
        model: 'text-embedding-3-small',
      };
      const cmd = openaiEmbeddingProvider.buildShellCommand(batchRequest, config);

      expect(cmd).toContain('text one');
      expect(cmd).toContain('text two');
    });
  });

  describe('parseResponse', () => {
    it('parses single embedding response', () => {
      const stdout = JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
      });

      const result = openaiEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({ embeddings: [[0.1, 0.2, 0.3]] });
    });

    it('parses batch embedding response sorted by index', () => {
      const stdout = JSON.stringify({
        data: [
          { embedding: [0.4, 0.5, 0.6], index: 1 },
          { embedding: [0.1, 0.2, 0.3], index: 0 },
        ],
      });

      const result = openaiEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      });
    });

    it('returns null for missing data', () => {
      expect(openaiEmbeddingProvider.parseResponse(JSON.stringify({}))).toBeNull();
    });

    it('returns null for item with empty embedding', () => {
      const stdout = JSON.stringify({
        data: [{ embedding: [], index: 0 }],
      });

      const result = openaiEmbeddingProvider.parseResponse(stdout);
      expect(result).toEqual({ embeddings: [null] });
    });

    it('returns null for invalid JSON', () => {
      expect(openaiEmbeddingProvider.parseResponse('{{{')).toBeNull();
    });

    it('returns null for item with missing embedding field', () => {
      const stdout = JSON.stringify({
        data: [{}],
      });

      const result = openaiEmbeddingProvider.parseResponse(stdout);
      expect(result).toEqual({ embeddings: [null] });
    });

    it('returns null for bad items in batch instead of failing entire batch', () => {
      const stdout = JSON.stringify({
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [], index: 1 },
        ],
      });

      const result = openaiEmbeddingProvider.parseResponse(stdout);

      expect(result).toEqual({
        embeddings: [[0.1, 0.2], null],
      });
    });
  });
});
