import { anthropicProvider } from '../../providers/anthropic';
import type { CompletionRequest, ProviderConfig } from '../../providers/types';

const request: CompletionRequest = {
  prefix: 'const x = ',
  suffix: ';\nconsole.log(x);',
  language: 'typescript',
  filePath: '/project/main.ts',
  maxTokens: 128,
  temperature: 0,
};

const config: ProviderConfig = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
};

describe('anthropicProvider', () => {
  it('has correct name and defaults', () => {
    expect(anthropicProvider.name).toBe('anthropic');
    expect(anthropicProvider.defaultEndpoint).toContain('anthropic.com');
  });

  describe('buildShellCommand', () => {
    it('includes curl with correct flags', () => {
      const cmd = anthropicProvider.buildShellCommand(request, config);

      expect(cmd).toContain('curl --silent --show-error --max-time 30');
      expect(cmd).toContain('-X POST');
      expect(cmd).toContain("Content-Type: application/json");
    });

    it('includes anthropic auth header with env var reference', () => {
      const cmd = anthropicProvider.buildShellCommand(request, config);

      expect(cmd).toContain('x-api-key: $ANTHROPIC_API_KEY');
    });

    it('includes anthropic-version header', () => {
      const cmd = anthropicProvider.buildShellCommand(request, config);

      expect(cmd).toContain('anthropic-version: 2023-06-01');
    });

    it('includes shell-escaped endpoint', () => {
      const cmd = anthropicProvider.buildShellCommand(request, config);

      expect(cmd).toContain("'https://api.anthropic.com/v1/messages'");
    });

    it('includes model and max_tokens in body', () => {
      const cmd = anthropicProvider.buildShellCommand(request, config);

      expect(cmd).toContain('claude-sonnet-4-20250514');
      expect(cmd).toContain('"max_tokens":128');
    });
  });

  describe('parseResponse', () => {
    it('parses valid response', () => {
      const stdout = JSON.stringify({
        content: [{ type: 'text', text: 'completed code' }],
        stop_reason: 'end_turn',
      });

      const result = anthropicProvider.parseResponse(stdout);

      expect(result).toEqual({
        text: 'completed code',
        finishReason: 'end_turn',
      });
    });

    it('returns null for missing content', () => {
      expect(anthropicProvider.parseResponse(JSON.stringify({}))).toBeNull();
    });

    it('returns null for non-text block', () => {
      const stdout = JSON.stringify({
        content: [{ type: 'tool_use', id: 'test' }],
      });

      expect(anthropicProvider.parseResponse(stdout)).toBeNull();
    });

    it('returns null for empty text', () => {
      const stdout = JSON.stringify({
        content: [{ type: 'text', text: '   ' }],
      });

      expect(anthropicProvider.parseResponse(stdout)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(anthropicProvider.parseResponse('not json')).toBeNull();
    });

    it('uses "unknown" when stop_reason missing', () => {
      const stdout = JSON.stringify({
        content: [{ type: 'text', text: 'code' }],
      });

      const result = anthropicProvider.parseResponse(stdout);
      expect(result!.finishReason).toBe('unknown');
    });
  });
});
