# Fresh-AI

AI-powered autocomplete plugin for the [Fresh](https://getfresh.dev) editor. Provides inline ghost-text suggestions with multi-provider support, RAG-based workspace context, and intelligent multi-line completion.

## Features

- **Multi-provider support** — OpenAI-compatible, Anthropic, and Ollama
- **RAG workspace indexing** — semantic code search for context-aware completions
- **Ghost text suggestions** — inline preview with partial acceptance (word/line)
- **Intelligent indentation** — re-indents multi-line suggestions to match context
- **Configurable** — models, debounce, context size, caching, and more
- **Persistent cache** — embedding cache survives editor restarts

## Installation

1. Clone into your Fresh plugins directory:
   ```sh
   git clone <repo-url> ~/.config/fresh/plugins/ai-autocomplete
   ```

2. Set your API key(s):
   ```sh
   export MISTRAL_API_KEY="your-key"     # For Codestral (default autocomplete)
   export OPENAI_API_KEY="your-key"       # For embeddings (default)
   ```

3. Restart Fresh — the plugin auto-initializes.

## Configuration

Config file: `~/.config/ai-autocomplete.json`

### Global Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable autocomplete |
| `debounceMs` | number | `300` | Delay before triggering completion |
| `maxContextLines` | number | `50` | Lines of context sent to the model |
| `disabledExtensions` | string[] | `[".md", ".txt"]` | File extensions to skip |

### Model Configuration

Models are configured under the `models` key. Each model has a name and a set of tasks it handles.

```json
{
  "models": {
    "codestral": {
      "provider": "openai-compatible",
      "endpoint": "https://api.mistral.ai/v1/chat/completions",
      "model": "codestral-latest",
      "apiKeyEnv": "MISTRAL_API_KEY",
      "maxTokens": 128,
      "temperature": 0.0,
      "tasks": ["autocomplete"]
    },
    "embedder": {
      "provider": "openai-compatible",
      "endpoint": "https://api.openai.com/v1/embeddings",
      "model": "text-embedding-3-small",
      "apiKeyEnv": "OPENAI_API_KEY",
      "maxTokens": 0,
      "temperature": 0.0,
      "tasks": ["embedding"]
    }
  }
}
```

### RAG Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `rag.persistCache` | boolean | `true` | Save embeddings to disk |
| `rag.workspaceIndexing` | boolean | `true` | Index workspace on startup |
| `rag.maxWorkspaceFiles` | number | `1000` | Max files to index |
| `rag.chunkTargetLines` | number | `30` | Target lines per chunk |
| `rag.chunkOverlapLines` | number | `5` | Overlap between chunks |
| `rag.indexBatchSize` | number | `5` | Files per indexing batch |
| `rag.indexBatchDelayMs` | number | `100` | Delay between batches |
| `rag.saveDebounceSec` | number | `30` | Cache save debounce |

### Environment Variable Overrides

Per-task overrides via env vars (prefix: `AI_AUTOCOMPLETE_` or `AI_EMBEDDING_`):

```sh
AI_AUTOCOMPLETE_PROVIDER=ollama
AI_AUTOCOMPLETE_ENDPOINT=http://localhost:11434/api/generate
AI_AUTOCOMPLETE_MODEL=codellama
```

## Provider Setup

### OpenAI-Compatible (Mistral, OpenAI, etc.)

```json
{
  "provider": "openai-compatible",
  "endpoint": "https://api.mistral.ai/v1/chat/completions",
  "model": "codestral-latest",
  "apiKeyEnv": "MISTRAL_API_KEY"
}
```

### Anthropic

```json
{
  "provider": "anthropic",
  "endpoint": "https://api.anthropic.com/v1/messages",
  "model": "claude-sonnet-4-20250514",
  "apiKeyEnv": "ANTHROPIC_API_KEY"
}
```

### Ollama (Local)

```json
{
  "provider": "ollama",
  "endpoint": "http://localhost:11434/api/generate",
  "model": "codellama",
  "apiKeyEnv": "NONE"
}
```

No API key required for Ollama.

## Commands

| Command | Mode | Description |
|---------|------|-------------|
| `ai_accept_suggestion` | insert | Accept full suggestion (Tab) |
| `ai_accept_word` | insert | Accept next word from suggestion |
| `ai_accept_line` | insert | Accept next line from suggestion |
| `ai_dismiss_suggestion` | insert | Dismiss current suggestion |
| `ai_toggle_autocomplete` | any | Enable/disable autocomplete |
| `ai_trigger_completion` | any | Manually trigger completion |
| `ai_reload_config` | any | Reload config from disk |
| `ai_clear_cache` | any | Clear RAG embedding cache |
| `ai_reindex_workspace` | any | Re-index all workspace files |

## Architecture

```
main.ts              → Plugin init, event/command routing
config.ts            → Config loading, validation, env overrides
engine/
  autocomplete.ts    → Debounced completion flow, state machine
  suggestion.ts      → Ghost text rendering, partial acceptance, reindent
  context.ts         → Buffer context extraction (prefix/suffix)
  rag.ts             → Vector store, cosine similarity, LRU eviction
  embedding.ts       → Batch embedding via provider
  workspace.ts       → Git-based file discovery, batched indexing
  chunking.ts        → Semantic code splitting with boundary detection
  persistence.ts     → Cache serialization, config hash validation
providers/
  types.ts           → Provider interfaces
  registry.ts        → Provider registration and resolution
  prompts.ts         → System prompts and FIM format
  openai-compatible.ts, anthropic.ts, ollama.ts → Completion providers
  openai-embedding.ts, ollama-embedding.ts      → Embedding providers
bridge.ts            → Shell command execution, atomic file writes
```

## Development

```sh
npm install
npm test              # Run tests (vitest)
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```
