# Architecture

## Component Overview

```
main.ts                  Plugin entry point, event/command registration
config.ts                Config loading, validation, env var overrides
bridge.ts                Shell command execution, atomic file writes

engine/
  autocomplete.ts        State machine, debounced completion flow
  suggestion.ts          Ghost text rendering, partial acceptance, re-indentation
  context.ts             Buffer context extraction (prefix/suffix), language detection
  rag.ts                 In-memory vector store, cosine similarity, LRU eviction
  embedding.ts           Embedding API calls via provider abstraction
  workspace.ts           Git-based file discovery, batched workspace indexing
  chunking.ts            Semantic code splitting with boundary detection
  persistence.ts         Cache serialization/deserialization, config hash validation
  metrics.ts             Session statistics tracking

providers/
  types.ts               Provider and EmbeddingProvider interfaces
  registry.ts            Provider lookup and config resolution
  prompts.ts             System prompts and fill-in-the-middle prompt construction
  openai-compatible.ts   OpenAI/Mistral completions provider
  anthropic.ts           Anthropic Messages API provider
  ollama.ts              Ollama local completions provider
  openai-embedding.ts    OpenAI-format embedding provider
  ollama-embedding.ts    Ollama embedding provider
```

## Data Flow

### Completion Request

```
User types
  |
  v
buffer_modified event
  |
  v
onBufferModified() -- increment requestId, cancel active request, clear ghost text
  |
  v
debounce (config.debounceMs)
  |
  v
triggerCompletion()
  |-- check: enabled? valid buffer? extension not disabled? API key set?
  |
  v
gatherContext() -- extract prefix/suffix from buffer, detect language
  |
  v
findRelevant() -- embed prefix, cosine similarity search, top-3 chunks
  |
  v
provider.buildShellCommand() -- construct curl command (API key via shell expansion)
  |
  v
spawnCancellable() -- sh -c "curl ..."
  |
  v
provider.parseResponse() -- extract completion text
  |
  v
showGhostText() -- re-indent, render virtual text at cursor position
```

### State Machine

The autocomplete engine maintains one of five states:

```
idle --[buffer modified]--> debouncing
debouncing --[debounce elapsed]--> requesting
requesting --[response received]--> showing
requesting --[error]--> error
showing --[accept/dismiss/new edit]--> idle
error --[new edit]--> debouncing
any --[new buffer edit]--> debouncing (cancels in-flight)
```

State transitions:

- **idle**: No active completion. Waiting for user input.
- **debouncing**: User typed. Waiting `debounceMs` before making a request.
- **requesting**: API request in flight. Status bar shows "AI: thinking..."
- **showing**: Ghost text is visible. Waiting for accept, dismiss, or new edit.
- **error**: Last request failed. Next edit restarts the cycle.

### Request Cancellation

Each request gets an incrementing `requestId`. When a new edit occurs:

1. `requestId` is incremented (invalidating any pending debounce or in-flight request)
2. The active process (if any) is killed via `editor.killProcess()`
3. Existing ghost text is cleared

This ensures only the most recent request produces visible results.

### RAG Pipeline

```
Workspace files (git ls-files)
  |
  v
discoverFiles() -- filter by extension, cap at maxWorkspaceFiles
  |
  v
indexFile() -- read file, hash content, skip if unchanged
  |
  v
splitIntoChunks() -- semantic splitting with boundary detection
  |
  v
embedBatch() -- send chunks to embedding provider
  |
  v
In-memory store (Map<filePath, CodeChunk[]>)
  |
  v
findRelevant(query, topK=3) -- embed query, cosine similarity, return top chunks
  |
  v
Included in completion prompt as context
```

### Provider Abstraction

Providers implement the `Provider` interface:

```typescript
interface Provider {
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string;
  parseResponse(stdout: string): CompletionResponse | null;
}
```

Embedding providers implement `EmbeddingProvider` with the same pattern.

All API calls are made via `curl` through shell execution (`sh -c`). API keys are referenced as shell variables (`$VAR_NAME`) and are never included in process arguments directly.

### Shell Command Execution

The `bridge.ts` module provides:

- **`spawnCancellable()`**: Launches `sh -c <command>` as a background process, returns a handle with `wait()` and `cancel()` methods
- **`writeFile()`**: Atomic file writes via temp file + rename. Large files (>100KB) are written in chunks.
- **`shellEscape()`**: Single-quote wrapping with proper escaping. Rejects null bytes.
- **`cleanupAllProcesses()`**: Kills all tracked background processes on shutdown.

### Ghost Text Rendering

Suggestions are displayed using Fresh's virtual text API:

- Each line of the suggestion gets a namespaced virtual text entry (`ai-ghost:0`, `ai-ghost:1`, etc.)
- First line: placed at cursor offset
- Subsequent lines: placed at newline positions in the buffer after the cursor
- Color: RGB(100, 100, 100) -- muted grey
- On dismiss/accept: all entries with the `ai-ghost:` prefix are removed
