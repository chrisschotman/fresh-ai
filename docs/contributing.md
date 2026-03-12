# Contributing

## Development Setup

```sh
git clone <repo-url>
cd fresh-ai
npm install
```

## Running Tests

```sh
npm test              # Run tests (vitest)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Linting and Type Checking

```sh
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
```

## Project Structure

```
plugins/ai-autocomplete/
  main.ts              Entry point, event/command registration
  config.ts            Configuration types, loading, validation
  bridge.ts            Shell execution, file I/O
  engine/              Core logic
    autocomplete.ts    Completion state machine
    suggestion.ts      Ghost text rendering
    context.ts         Buffer context extraction
    rag.ts             Vector store
    embedding.ts       Embedding API calls
    workspace.ts       File discovery and indexing
    chunking.ts        Code splitting
    persistence.ts     Cache I/O
    metrics.ts         Performance tracking
  providers/           Provider implementations
    types.ts           Interfaces
    registry.ts        Provider lookup
    prompts.ts         Prompt templates
    openai-compatible.ts
    anthropic.ts
    ollama.ts
    openai-embedding.ts
    ollama-embedding.ts
```

## Adding a New Completion Provider

1. Create `providers/your-provider.ts` implementing the `Provider` interface:

```typescript
import type { Provider, CompletionRequest, CompletionResponse, ProviderConfig } from './types';
import { shellEscape } from '../bridge';

export const yourProvider: Provider = {
  name: 'your-provider',
  defaultEndpoint: 'https://api.example.com/v1/completions',
  defaultModel: 'default-model',

  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string {
    // Construct a curl command that calls the API
    // Use shellEscape() for all dynamic values
    // Reference API keys as shell variables: $${config.apiKeyEnv}
    const body = JSON.stringify({ /* ... */ });
    return `curl --silent --show-error --max-time 30 -X POST -H 'Content-Type: application/json' -d ${shellEscape(body)} ${shellEscape(config.endpoint)}`;
  },

  parseResponse(stdout: string): CompletionResponse | null {
    // Parse the JSON response and extract the completion text
    // Return null if parsing fails or response is empty
    try {
      const json = JSON.parse(stdout);
      const text = /* extract text from json */;
      return { text, finishReason: 'stop' };
    } catch {
      return null;
    }
  },
};
```

2. Register it in `providers/registry.ts`:

```typescript
import { yourProvider } from './your-provider';

const providers: Record<string, Provider> = {
  'openai-compatible': openaiCompatibleProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  'your-provider': yourProvider, // add here
};
```

3. Users can now configure it:

```json
{
  "models": {
    "my-model": {
      "provider": "your-provider",
      "endpoint": "https://api.example.com/v1/completions",
      "model": "model-name",
      "apiKeyEnv": "MY_API_KEY",
      "tasks": ["autocomplete"]
    }
  }
}
```

## Adding a New Embedding Provider

Same pattern, but implement the `EmbeddingProvider` interface and register in the `embeddingProviders` map in `registry.ts`.

## Key Design Decisions

- **Shell execution via curl**: All API calls use `curl` through `sh -c`. This avoids needing HTTP client libraries and allows API keys to be referenced as shell variables (never appearing in process arguments).
- **Request ID pattern**: Each new edit increments a `requestId`. All async operations check this ID before producing side effects, ensuring stale responses are discarded.
- **LRU vector store**: The 500-chunk limit with LRU eviction keeps memory bounded while prioritizing recently relevant files.
- **FNV-1a content hashing**: Fast, non-cryptographic hash used to detect file changes and avoid redundant embedding calls.
- **Atomic file writes**: Cache persistence uses temp file + rename to prevent corruption.

## Code Style

- TypeScript strict mode
- No `any` types -- use `unknown` with type narrowing
- Error handling: catch blocks use `catch (err: unknown)` pattern
- All async operations are properly awaited or explicitly `void`-cast for fire-and-forget
