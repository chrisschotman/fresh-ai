import type { Provider, ProviderConfig, EmbeddingProvider } from './types';
import { openaiCompatibleProvider } from './openai-compatible';
import { anthropicProvider } from './anthropic';
import { ollamaProvider } from './ollama';
import { openaiEmbeddingProvider } from './openai-embedding';
import { ollamaEmbeddingProvider } from './ollama-embedding';
import { getModelForTask } from '../config';

const API_KEY_ENV_PATTERN = /^[A-Z_][A-Z0-9_]*$/i;

const providers: Record<string, Provider> = {
  'openai-compatible': openaiCompatibleProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
};

const embeddingProviders: Record<string, EmbeddingProvider> = {
  'openai-compatible': openaiEmbeddingProvider,
  ollama: ollamaEmbeddingProvider,
};

export function resolveProviderConfig(
  modelConfig: { endpoint: string; model: string; apiKeyEnv: string },
  defaults: { defaultEndpoint: string; defaultModel: string },
): ProviderConfig | null {
  if (!API_KEY_ENV_PATTERN.test(modelConfig.apiKeyEnv)) return null;

  return {
    endpoint: modelConfig.endpoint !== '' ? modelConfig.endpoint : defaults.defaultEndpoint,
    model: modelConfig.model !== '' ? modelConfig.model : defaults.defaultModel,
    apiKeyEnv: modelConfig.apiKeyEnv,
  };
}

export function getProvider(): Provider | null {
  const model = getModelForTask('autocomplete');
  if (model === null) return null;
  return providers[model.provider] ?? null;
}

export function getProviderByName(name: string): Provider | null {
  return providers[name] ?? null;
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  const model = getModelForTask('embedding');
  if (model === null) return null;
  return embeddingProviders[model.provider] ?? null;
}

export function getEmbeddingProviderByName(name: string): EmbeddingProvider | null {
  return embeddingProviders[name] ?? null;
}
