# Configuration

Config file location: `~/.config/ai-autocomplete.json`

The plugin loads this file on startup and when the `AI: Reload Config` command is executed.

## Global Settings

| Setting              | Type     | Default           | Description                                                                                     |
| -------------------- | -------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `enabled`            | boolean  | `true`            | Enable/disable autocomplete globally                                                            |
| `debounceMs`         | number   | `300`             | Milliseconds to wait after typing before triggering a completion. Must be >= 0                  |
| `maxContextLines`    | number   | `50`              | Lines of context (prefix + suffix) sent to the model. Estimated at ~80 chars/line. Must be >= 1 |
| `disabledExtensions` | string[] | `[".md", ".txt"]` | File extensions for which autocomplete is skipped entirely                                      |
| `logVerbosity`       | string   | `"off"`           | Logging level. One of: `"off"`, `"minimal"`, `"verbose"`                                        |

## Model Configuration

Models are configured under the `models` key. Each model entry specifies a provider, endpoint, and the task(s) it handles. There are two valid tasks: `"autocomplete"` and `"embedding"`. Each task can only be assigned to one model.

### Model Properties

| Property      | Type     | Description                                                                     |
| ------------- | -------- | ------------------------------------------------------------------------------- |
| `provider`    | string   | Provider name: `"openai-compatible"`, `"anthropic"`, or `"ollama"`              |
| `endpoint`    | string   | Full API URL. Must start with `http://` or `https://`                           |
| `model`       | string   | Model identifier (e.g., `"codestral-latest"`, `"claude-sonnet-4-20250514"`)     |
| `apiKeyEnv`   | string   | Environment variable name containing the API key. Must match `[A-Z_][A-Z0-9_]*` |
| `maxTokens`   | number   | Maximum tokens for completion output. Range: 0-4096                             |
| `temperature` | number   | Sampling temperature. Range: 0-2                                                |
| `tasks`       | string[] | Tasks this model handles: `["autocomplete"]`, `["embedding"]`, or both          |

### Default Models

If no `models` key is provided, the plugin uses these defaults:

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

### Task Validation

- Each task (`autocomplete`, `embedding`) can only be claimed by one model
- If a configured model claims a task already taken by another model, that task is silently removed
- If no model claims a required task, the default model for that task is added automatically
- Models with zero valid tasks after validation are skipped

### Legacy Flat Config

For backward compatibility, you can specify provider/model/endpoint/apiKeyEnv at the top level instead of under `models`. These are treated as a single model assigned to the `autocomplete` task:

```json
{
  "provider": "anthropic",
  "endpoint": "https://api.anthropic.com/v1/messages",
  "model": "claude-sonnet-4-20250514",
  "apiKeyEnv": "ANTHROPIC_API_KEY"
}
```

## RAG Settings

RAG (Retrieval-Augmented Generation) settings control workspace indexing and the embedding cache. All are nested under the `rag` key.

| Setting                      | Type    | Default | Description                                                                         |
| ---------------------------- | ------- | ------- | ----------------------------------------------------------------------------------- |
| `rag.persistCache`           | boolean | `true`  | Save embedding cache to disk (`~/.config/rag-cache.json`). Survives editor restarts |
| `rag.workspaceIndexing`      | boolean | `true`  | Automatically index workspace files on startup                                      |
| `rag.maxWorkspaceFiles`      | number  | `1000`  | Maximum number of files to discover and index. Must be >= 1                         |
| `rag.chunkTargetLines`       | number  | `30`    | Target number of lines per code chunk. Must be >= 1                                 |
| `rag.chunkOverlapLines`      | number  | `5`     | Number of overlapping lines between consecutive chunks. Must be >= 0                |
| `rag.chunkRespectBoundaries` | boolean | `true`  | Snap chunk boundaries to function/class definitions when nearby                     |
| `rag.indexBatchSize`         | number  | `5`     | Number of files to embed per batch. Must be >= 1                                    |
| `rag.indexBatchDelayMs`      | number  | `100`   | Delay in milliseconds between batches to avoid overwhelming the API. Must be >= 0   |
| `rag.saveDebounceSec`        | number  | `30`    | Seconds to wait before writing cache to disk after changes. Must be >= 0            |

## Environment Variable Overrides

You can override model settings per-task using environment variables. The prefix is `AI_<TASK>_` where `<TASK>` is `AUTOCOMPLETE` or `EMBEDDING`:

| Env Var                       | Overrides                                       |
| ----------------------------- | ----------------------------------------------- |
| `AI_AUTOCOMPLETE_PROVIDER`    | Provider for the autocomplete model             |
| `AI_AUTOCOMPLETE_ENDPOINT`    | Endpoint URL for the autocomplete model         |
| `AI_AUTOCOMPLETE_MODEL`       | Model name for the autocomplete model           |
| `AI_AUTOCOMPLETE_API_KEY_ENV` | API key env var name for the autocomplete model |
| `AI_EMBEDDING_PROVIDER`       | Provider for the embedding model                |
| `AI_EMBEDDING_ENDPOINT`       | Endpoint URL for the embedding model            |
| `AI_EMBEDDING_MODEL`          | Model name for the embedding model              |
| `AI_EMBEDDING_API_KEY_ENV`    | API key env var name for the embedding model    |

Environment variable overrides are applied after the config file is loaded, so they take precedence.

### Example: Switch to Ollama via Env Vars

```sh
export AI_AUTOCOMPLETE_PROVIDER=ollama
export AI_AUTOCOMPLETE_ENDPOINT=http://localhost:11434/api/generate
export AI_AUTOCOMPLETE_MODEL=codellama
```

## Full Example Config

```json
{
  "enabled": true,
  "debounceMs": 200,
  "maxContextLines": 80,
  "disabledExtensions": [".md", ".txt", ".log"],
  "logVerbosity": "minimal",
  "models": {
    "claude": {
      "provider": "anthropic",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": 256,
      "temperature": 0.1,
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
  },
  "rag": {
    "persistCache": true,
    "workspaceIndexing": true,
    "maxWorkspaceFiles": 500,
    "chunkTargetLines": 40,
    "chunkOverlapLines": 8,
    "indexBatchSize": 10,
    "indexBatchDelayMs": 50,
    "saveDebounceSec": 60
  }
}
```
