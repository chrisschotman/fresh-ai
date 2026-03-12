import { loadConfig, getConfig, getModelForTask, setEnabled } from './config';
import { onBufferModified, triggerCompletion, dismiss } from './engine/autocomplete';
import { acceptSuggestion, clearGhostText, hasSuggestion } from './engine/suggestion';
import { indexBuffer, invalidateBuffer, initStore, clearStore, setContentHash } from './engine/rag';
import { hashContent } from './engine/persistence';
import { indexWorkspace } from './engine/workspace';
// --- Event handlers (must be on globalThis for Fresh) ---

globalThis.ai_autocomplete_buffer_modified = async function (): Promise<void> {
  await onBufferModified();
};

globalThis.ai_autocomplete_cursor_moved = function (): void {
  // If we have a suggestion and cursor moved, dismiss it
  if (hasSuggestion()) {
    const bufferId = editor.getActiveBufferId();
    if (bufferId !== null) {
      clearGhostText(bufferId);
    }
  }
};

// --- Command handlers ---

globalThis.ai_autocomplete_accept = function (): void {
  if (!acceptSuggestion()) {
    editor.setStatus('AI: no suggestion to accept');
  }
};

globalThis.ai_autocomplete_dismiss = async function (): Promise<void> {
  await dismiss();
  editor.setStatus('AI: suggestion dismissed');
};

globalThis.ai_autocomplete_toggle = async function (): Promise<void> {
  const config = getConfig();
  const nowEnabled = !config.enabled;
  setEnabled(nowEnabled);
  editor.setStatus(`AI Autocomplete: ${nowEnabled ? 'enabled' : 'disabled'}`);

  if (!nowEnabled) {
    await dismiss();
  }
};

globalThis.ai_autocomplete_trigger = async function (): Promise<void> {
  await triggerCompletion();
};

globalThis.ai_autocomplete_reload_config = async function (): Promise<void> {
  await loadConfig();
  editor.setStatus('AI Autocomplete: config reloaded');
};

globalThis.ai_autocomplete_buffer_saved = async function (): Promise<void> {
  const bufferId = editor.getActiveBufferId();
  if (bufferId === null) return;

  const config = getConfig();
  if (!config.enabled) return;

  const embeddingModel = getModelForTask('embedding');
  if (embeddingModel === null) return;

  const filePath = editor.getBufferPath(bufferId);
  invalidateBuffer(filePath);

  try {
    await indexBuffer(bufferId);

    // Update content hash so workspace indexer skips this file
    const length = editor.getBufferLength(bufferId);
    const text = await editor.getBufferText(bufferId, 0, length);
    if (text.trim() !== '') {
      setContentHash(filePath, hashContent(text));
    }
  } catch {
    // Indexing failure is non-fatal
  }
};

globalThis.ai_reindex_workspace = async function (): Promise<void> {
  const config = getConfig();
  const embeddingModel = getModelForTask('embedding');
  if (embeddingModel === null) {
    editor.setStatus('AI: no embedding model configured');
    return;
  }

  clearStore();

  if (config.rag.persistCache) {
    await initStore(embeddingModel.model, embeddingModel.provider, config.rag.saveDebounceSec);
  }

  await indexWorkspace(config.rag, config.disabledExtensions);
};

// --- Initialization ---

async function init(): Promise<void> {
  await loadConfig();

  const config = getConfig();
  const embeddingModel = getModelForTask('embedding');

  // Initialize persistent store
  if (config.rag.persistCache && embeddingModel !== null) {
    await initStore(embeddingModel.model, embeddingModel.provider, config.rag.saveDebounceSec);
  }

  // Register event listeners
  editor.on('buffer_modified', 'ai_autocomplete_buffer_modified');
  editor.on('cursor_moved', 'ai_autocomplete_cursor_moved');
  editor.on('buffer_saved', 'ai_autocomplete_buffer_saved');

  // Register commands
  editor.registerCommand(
    'ai_accept_suggestion',
    'AI: Accept Suggestion',
    'ai_autocomplete_accept',
    'insert',
  );

  editor.registerCommand(
    'ai_dismiss_suggestion',
    'AI: Dismiss Suggestion',
    'ai_autocomplete_dismiss',
    'insert',
  );

  editor.registerCommand(
    'ai_toggle_autocomplete',
    'AI: Toggle Autocomplete',
    'ai_autocomplete_toggle',
  );

  editor.registerCommand(
    'ai_trigger_completion',
    'AI: Trigger Completion',
    'ai_autocomplete_trigger',
  );

  editor.registerCommand('ai_reload_config', 'AI: Reload Config', 'ai_autocomplete_reload_config');

  editor.registerCommand(
    'ai_reindex_workspace',
    'AI: Re-index Workspace',
    'ai_reindex_workspace',
  );

  const model = getModelForTask('autocomplete');
  if (model !== null) {
    editor.setStatus(`AI Autocomplete: loaded (${model.provider}/${model.model})`);
  } else {
    editor.setStatus('AI Autocomplete: loaded (no autocomplete model configured)');
  }

  // Fire-and-forget workspace indexing
  if (config.rag.workspaceIndexing && embeddingModel !== null) {
    void indexWorkspace(config.rag, config.disabledExtensions);
  }
}

void init();
