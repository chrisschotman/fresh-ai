import { spawnCancellable } from '../bridge';
import { getModelForTask, getApiKeyForTask } from '../config';
import { getEmbeddingProviderByName, resolveProviderConfig } from '../providers/registry';
import { recordEmbedding } from './metrics';

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  const modelConfig = getModelForTask('embedding');
  if (modelConfig === null) {
    editor.setStatus('AI: no embedding model configured');
    return texts.map(() => null);
  }

  if (modelConfig.provider !== 'ollama') {
    const apiKey = getApiKeyForTask('embedding');
    if (apiKey === '') {
      editor.setStatus(`AI: no API key found in ${modelConfig.apiKeyEnv} for embeddings`);
      return texts.map(() => null);
    }
  }

  const provider = getEmbeddingProviderByName(modelConfig.provider);
  if (provider === null) {
    editor.setStatus(`AI: unknown embedding provider "${modelConfig.provider}"`);
    return texts.map(() => null);
  }

  const providerConfig = resolveProviderConfig(modelConfig, provider);
  if (providerConfig === null) return texts.map(() => null);

  const request = {
    input: texts,
    model: providerConfig.model,
  };

  const shellCommand = provider.buildShellCommand(request, providerConfig);

  const start = Date.now();
  try {
    const handle = await spawnCancellable(shellCommand);
    const result = await handle.wait();
    recordEmbedding(Date.now() - start);

    if (result.exitCode !== 0) {
      editor.setStatus('AI: embedding request failed');
      return texts.map(() => null);
    }

    const response = provider.parseResponse(result.stdout);
    if (response === null) return texts.map(() => null);

    // Align response with input — pad with nulls if needed
    return texts.map((_, i) => response.embeddings[i] ?? null);
  } catch {
    recordEmbedding(Date.now() - start);
    return texts.map(() => null);
  }
}

export async function embed(text: string): Promise<number[] | null> {
  const results = await embedBatch([text]);
  return results[0] ?? null;
}
