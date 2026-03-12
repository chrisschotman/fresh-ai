import type { Provider, CompletionRequest, CompletionResponse, ProviderConfig } from './types';
import { getSystemPrompt, buildFimPrompt } from './prompts';
import { shellEscape } from '../bridge';

interface OpenAIChoice {
  message?: { content?: string };
  text?: string;
  finish_reason?: string;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

export const openaiCompatibleProvider: Provider = {
  name: 'openai-compatible',
  defaultEndpoint: 'https://api.mistral.ai/v1/chat/completions',
  defaultModel: 'codestral-latest',

  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string {
    const body = JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: getSystemPrompt(request.language) },
        { role: 'user', content: buildFimPrompt(request) },
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stop: ['\n\n\n'],
    });

    // API key referenced as env var — expanded by shell, never in process args
    return [
      'curl --silent --show-error --max-time 30',
      '-X POST',
      "-H 'Content-Type: application/json'",
      `-H "Authorization: Bearer $${config.apiKeyEnv}"`,
      `-d ${shellEscape(body)}`,
      shellEscape(config.endpoint),
    ].join(' ');
  },

  parseResponse(stdout: string): CompletionResponse | null {
    try {
      const json = JSON.parse(stdout) as OpenAIResponse;
      const choice = json.choices?.[0];
      if (choice === undefined) return null;

      const text = choice.message?.content ?? choice.text ?? '';
      if (text.trim() === '') return null;

      return {
        text: text,
        finishReason: choice.finish_reason ?? 'unknown',
      };
    } catch {
      return null;
    }
  },
};
