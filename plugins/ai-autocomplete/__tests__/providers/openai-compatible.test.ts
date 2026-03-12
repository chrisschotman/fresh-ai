import { openaiCompatibleProvider } from '../../providers/openai-compatible';
import type { CompletionRequest, ProviderConfig } from '../../providers/types';

const request: CompletionRequest = {
  prefix: 'function add(',
  suffix: ')\n}',
  language: 'typescript',
  filePath: '/project/math.ts',
  maxTokens: 128,
  temperature: 0.1,
};

const config: ProviderConfig = {
  endpoint: 'https://api.mistral.ai/v1/chat/completions',
  model: 'codestral-latest',
  apiKeyEnv: 'MISTRAL_API_KEY',
};

describe('openaiCompatibleProvider', () => {
  it('has correct name and defaults', () => {
    expect(openaiCompatibleProvider.name).toBe('openai-compatible');
    expect(openaiCompatibleProvider.defaultModel).toBe('codestral-latest');
  });

  describe('buildShellCommand', () => {
    it('includes curl with correct flags', () => {
      const cmd = openaiCompatibleProvider.buildShellCommand(request, config);

      expect(cmd).toContain('curl --silent --show-error --max-time 30');
      expect(cmd).toContain('-X POST');
    });

    it('includes Bearer auth header with env var', () => {
      const cmd = openaiCompatibleProvider.buildShellCommand(request, config);

      expect(cmd).toContain('Authorization: Bearer $MISTRAL_API_KEY');
    });

    it('includes shell-escaped body and endpoint', () => {
      const cmd = openaiCompatibleProvider.buildShellCommand(request, config);

      expect(cmd).toContain('-d ');
      expect(cmd).toContain("'https://api.mistral.ai/v1/chat/completions'");
    });

    it('includes model and temperature in body', () => {
      const cmd = openaiCompatibleProvider.buildShellCommand(request, config);

      expect(cmd).toContain('codestral-latest');
    });
  });

  describe('parseResponse', () => {
    it('parses chat completion response', () => {
      const stdout = JSON.stringify({
        choices: [{ message: { content: 'a: number, b: number' }, finish_reason: 'stop' }],
      });

      const result = openaiCompatibleProvider.parseResponse(stdout);

      expect(result).toEqual({
        text: 'a: number, b: number',
        finishReason: 'stop',
      });
    });

    it('parses legacy text completion response', () => {
      const stdout = JSON.stringify({
        choices: [{ text: 'legacy text', finish_reason: 'length' }],
      });

      const result = openaiCompatibleProvider.parseResponse(stdout);

      expect(result).toEqual({
        text: 'legacy text',
        finishReason: 'length',
      });
    });

    it('returns null for missing choices', () => {
      expect(openaiCompatibleProvider.parseResponse(JSON.stringify({}))).toBeNull();
    });

    it('returns null for empty text', () => {
      const stdout = JSON.stringify({
        choices: [{ message: { content: '  ' } }],
      });

      expect(openaiCompatibleProvider.parseResponse(stdout)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(openaiCompatibleProvider.parseResponse('{{{')).toBeNull();
    });

    it('uses "unknown" when finish_reason missing', () => {
      const stdout = JSON.stringify({
        choices: [{ message: { content: 'code' } }],
      });

      const result = openaiCompatibleProvider.parseResponse(stdout);
      expect(result!.finishReason).toBe('unknown');
    });
  });
});
