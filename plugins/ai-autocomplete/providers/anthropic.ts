import type { Provider, CompletionRequest, CompletionResponse, ProviderConfig } from './types';
import { getSystemPrompt, buildFimPrompt } from './prompts';
import { shellEscape } from '../bridge';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
}

export const anthropicProvider: Provider = {
  name: 'anthropic',
  defaultEndpoint: 'https://api.anthropic.com/v1/messages',
  defaultModel: 'claude-sonnet-4-20250514',

  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string {
    const body = JSON.stringify({
      model: config.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: getSystemPrompt(request.language),
      messages: [{ role: 'user', content: buildFimPrompt(request) }],
    });

    // API key referenced as env var — expanded by shell, never in process args
    return [
      'curl --silent --show-error --max-time 30',
      '-X POST',
      "-H 'Content-Type: application/json'",
      `-H "x-api-key: $${config.apiKeyEnv}"`,
      "-H 'anthropic-version: 2023-06-01'",
      `-d ${shellEscape(body)}`,
      shellEscape(config.endpoint),
    ].join(' ');
  },

  parseResponse(stdout: string): CompletionResponse | null {
    try {
      const json = JSON.parse(stdout) as AnthropicResponse;
      const block = json.content?.[0];
      if (block?.type !== 'text') return null;

      const text = block.text ?? '';
      if (text.trim() === '') return null;

      return {
        text: text,
        finishReason: json.stop_reason ?? 'unknown',
      };
    } catch {
      return null;
    }
  },
};
