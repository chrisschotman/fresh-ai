import type { Provider, CompletionRequest, CompletionResponse, ProviderConfig } from './types';
import { shellEscape } from '../bridge';

interface OllamaResponse {
  response?: string;
  done?: boolean;
}

export const ollamaProvider: Provider = {
  name: 'ollama',
  defaultEndpoint: 'http://localhost:11434/api/generate',
  defaultModel: 'codellama',

  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string {
    let prompt = request.prefix;
    if (request.ragContext !== undefined && request.ragContext !== '') {
      prompt = `Here is relevant code from the project for context:\n---\n${request.ragContext}\n---\n\n${prompt}`;
    }

    const body = JSON.stringify({
      model: config.model,
      prompt,
      suffix: request.suffix,
      stream: false,
      options: {
        num_predict: request.maxTokens,
        temperature: request.temperature,
        stop: ['\n\n\n'],
      },
    });

    // Ollama needs no auth
    return [
      'curl --silent --show-error --max-time 30',
      '-X POST',
      "-H 'Content-Type: application/json'",
      `-d ${shellEscape(body)}`,
      shellEscape(config.endpoint),
    ].join(' ');
  },

  parseResponse(stdout: string): CompletionResponse | null {
    try {
      const json = JSON.parse(stdout) as OllamaResponse;
      const text = json.response ?? '';
      if (text.trim() === '') return null;

      return {
        text: text,
        finishReason: json.done === true ? 'stop' : 'unknown',
      };
    } catch {
      return null;
    }
  },
};
