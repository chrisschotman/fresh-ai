import { spawnCancellable } from '../bridge';
import { getConfig, getModelForTask, getApiKeyForTask, isExtensionDisabled } from '../config';
import { gatherContext } from './context';
import { showGhostText, clearGhostText, hasSuggestion } from './suggestion';
import { findRelevant } from './rag';
import { getProviderByName, resolveProviderConfig } from '../providers/registry';
import type { CompletionRequest } from '../providers/types';

type State = 'idle' | 'debouncing' | 'requesting' | 'showing';

let state: State = 'idle';
let requestId = 0;
let activeProcessId: number | null = null;

export function getState(): State {
  return state;
}

function setState(newState: State): void {
  state = newState;
}

async function cancelActiveRequest(): Promise<void> {
  if (activeProcessId !== null) {
    try {
      await editor.killProcess(activeProcessId);
    } catch {
      // Process may have already completed
    }
    activeProcessId = null;
  }
}

export async function triggerCompletion(): Promise<void> {
  requestId++;
  const config = getConfig();

  if (!config.enabled) return;

  const bufferId = editor.getActiveBufferId();
  if (bufferId === null) return;

  const filePath = editor.getBufferPath(bufferId);
  if (isExtensionDisabled(filePath)) return;

  const modelConfig = getModelForTask('autocomplete');
  if (modelConfig === null) {
    editor.setStatus('AI: No model configured for autocomplete');
    return;
  }

  if (modelConfig.provider !== 'ollama') {
    const apiKey = getApiKeyForTask('autocomplete');
    if (apiKey === '') {
      editor.setStatus(`AI: No API key found in ${modelConfig.apiKeyEnv}`);
      return;
    }
  }

  // Cancel any in-flight request
  await cancelActiveRequest();

  // Dismiss existing suggestion
  if (hasSuggestion()) {
    clearGhostText(bufferId);
  }

  const cursorOffset = editor.getCursorPosition();
  const context = await gatherContext(bufferId, cursorOffset, config.maxContextLines);

  // Skip if prefix is empty or just whitespace
  if (context.prefix.trim() === '') {
    setState('idle');
    return;
  }

  const provider = getProviderByName(modelConfig.provider);
  if (provider === null) {
    editor.setStatus(`AI: Unknown provider "${modelConfig.provider}"`);
    setState('idle');
    return;
  }

  // Gather RAG context (non-blocking: falls back gracefully)
  let ragContext: string | undefined;
  try {
    const relevantChunks = await findRelevant(context.prefix, 3);
    if (relevantChunks.length > 0) {
      ragContext = relevantChunks
        .map((c) => `// ${c.filePath}:${c.startLine.toString()}-${c.endLine.toString()}\n${c.content}`)
        .join('\n\n');
    }
  } catch {
    // RAG failure is non-fatal
  }

  const request: CompletionRequest = {
    prefix: context.prefix,
    suffix: context.suffix,
    language: context.language,
    filePath: context.filePath,
    maxTokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
    ragContext,
  };

  const providerConfig = resolveProviderConfig(modelConfig, provider);
  if (providerConfig === null) {
    editor.setStatus('AI: invalid provider configuration');
    setState('idle');
    return;
  }

  const shellCommand = provider.buildShellCommand(request, providerConfig);
  const thisRequestId = requestId;

  setState('requesting');
  editor.setStatus('AI: thinking...');

  try {
    const handle = await spawnCancellable(shellCommand);
    activeProcessId = handle.processId;

    const result = await handle.wait();
    activeProcessId = null;

    // Check if this request is still current
    if (thisRequestId !== requestId) return;

    if (result.exitCode !== 0) {
      editor.setStatus('AI: request failed');
      setState('idle');
      return;
    }

    const response = provider.parseResponse(result.stdout);
    if (response === null || response.text.trim() === '') {
      editor.setStatus('AI: no suggestion');
      setState('idle');
      return;
    }

    // Verify cursor hasn't moved
    const currentBufferId = editor.getActiveBufferId();
    const currentOffset = editor.getCursorPosition();
    if (currentBufferId !== bufferId || currentOffset !== cursorOffset) {
      setState('idle');
      return;
    }

    await showGhostText(bufferId, cursorOffset, response.text);
    setState('showing');
    editor.setStatus('AI: suggestion ready (Tab to accept)');
  } catch {
    activeProcessId = null;
    if (thisRequestId === requestId) {
      setState('idle');
    }
  }
}

export async function onBufferModified(): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  // Increment requestId to invalidate any pending/in-flight work
  requestId++;
  const thisRequestId = requestId;

  // Cancel active request
  await cancelActiveRequest();

  // Clear existing suggestion
  const bufferId = editor.getActiveBufferId();
  if (bufferId !== null && hasSuggestion()) {
    clearGhostText(bufferId);
  }

  setState('debouncing');

  // Debounce using editor.delay()
  await editor.delay(config.debounceMs);

  // Check if still current after delay
  if (thisRequestId !== requestId) return;

  await triggerCompletion();
}

export async function dismiss(): Promise<void> {
  requestId++;
  const bufferId = editor.getActiveBufferId();
  if (bufferId !== null) {
    clearGhostText(bufferId);
  }
  await cancelActiveRequest();
  setState('idle');
}
