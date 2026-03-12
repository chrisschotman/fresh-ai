import { ollamaProvider } from '../../providers/ollama';
import type { CompletionRequest, ProviderConfig } from '../../providers/types';

const request: CompletionRequest = {
  prefix: 'fn main() {',
  suffix: '\n}',
  language: 'rust',
  filePath: '/project/main.rs',
  maxTokens: 64,
  temperature: 0,
};

const config: ProviderConfig = {
  endpoint: 'http://localhost:11434/api/generate',
  model: 'codellama',
  apiKeyEnv: 'NONE',
};

describe('ollamaProvider', () => {
  it('has correct name and defaults', () => {
    expect(ollamaProvider.name).toBe('ollama');
    expect(ollamaProvider.defaultEndpoint).toContain('localhost:11434');
    expect(ollamaProvider.defaultModel).toBe('codellama');
  });

  describe('buildShellCommand', () => {
    it('includes curl with correct flags', () => {
      const cmd = ollamaProvider.buildShellCommand(request, config);

      expect(cmd).toContain('curl --silent --show-error --max-time 30');
    });

    it('does not include auth header', () => {
      const cmd = ollamaProvider.buildShellCommand(request, config);

      expect(cmd).not.toContain('Authorization');
      expect(cmd).not.toContain('x-api-key');
    });

    it('includes model in body', () => {
      const cmd = ollamaProvider.buildShellCommand(request, config);

      expect(cmd).toContain('codellama');
    });

    it('includes prompt and suffix in body', () => {
      const cmd = ollamaProvider.buildShellCommand(request, config);

      expect(cmd).toContain('fn main() {');
    });

    it('includes shell-escaped endpoint', () => {
      const cmd = ollamaProvider.buildShellCommand(request, config);

      expect(cmd).toContain("'http://localhost:11434/api/generate'");
    });
  });

  describe('parseResponse', () => {
    it('parses valid response', () => {
      const stdout = JSON.stringify({ response: 'println!("hello")', done: true });

      const result = ollamaProvider.parseResponse(stdout);

      expect(result).toEqual({
        text: 'println!("hello")',
        finishReason: 'stop',
      });
    });

    it('returns "unknown" finish reason when not done', () => {
      const stdout = JSON.stringify({ response: 'partial', done: false });

      const result = ollamaProvider.parseResponse(stdout);
      expect(result!.finishReason).toBe('unknown');
    });

    it('returns null for empty response', () => {
      const stdout = JSON.stringify({ response: '  ', done: true });

      expect(ollamaProvider.parseResponse(stdout)).toBeNull();
    });

    it('returns null for missing response field', () => {
      expect(ollamaProvider.parseResponse(JSON.stringify({}))).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(ollamaProvider.parseResponse('not json')).toBeNull();
    });
  });
});
