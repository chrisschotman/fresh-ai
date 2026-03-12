# Fresh-AI

AI-powered autocomplete plugin for the [Fresh](https://getfresh.dev) editor. Provides inline ghost-text suggestions with multi-provider support, RAG-based workspace context, and intelligent multi-line completion.

## Features

- **Multi-provider support** -- OpenAI-compatible, Anthropic, and Ollama
- **RAG workspace indexing** -- semantic code search for context-aware completions
- **Ghost text suggestions** -- inline preview with partial acceptance (word/line)
- **Intelligent indentation** -- re-indents multi-line suggestions to match context
- **Persistent cache** -- embedding cache survives editor restarts

## Quick Start

1. Clone into your Fresh plugins directory:

   ```sh
   git clone <repo-url> ~/.config/fresh/plugins/ai-autocomplete
   ```

2. Set your API key(s):

   ```sh
   export MISTRAL_API_KEY="your-key"     # For Codestral (default autocomplete)
   export OPENAI_API_KEY="your-key"       # For embeddings (default)
   ```

3. Restart Fresh -- the plugin auto-initializes.

## Documentation

| Topic                                                     | Description                                    |
| --------------------------------------------------------- | ---------------------------------------------- |
| [Getting Started](docs/getting-started.md)                | Installation, first config, verifying it works |
| [Configuration](docs/configuration.md)                    | All settings with explanations and examples    |
| [Commands](docs/commands.md)                              | All commands with keybinding info              |
| **Providers**                                             |                                                |
| [OpenAI-Compatible](docs/providers/openai-compatible.md)  | Codestral, Mistral, OpenAI setup               |
| [Anthropic](docs/providers/anthropic.md)                  | Claude setup                                   |
| [Ollama](docs/providers/ollama.md)                        | Local model setup                              |
| **Features**                                              |                                                |
| [RAG Indexing](docs/features/rag-indexing.md)             | How workspace indexing works                   |
| [Partial Acceptance](docs/features/partial-acceptance.md) | Word/line acceptance                           |
| [Caching](docs/features/caching.md)                       | Persistence and cache invalidation             |
| **Reference**                                             |                                                |
| [Troubleshooting](docs/troubleshooting.md)                | Common issues, logging, debugging              |
| [Architecture](docs/architecture.md)                      | Data flow, state machine, components           |
| [Contributing](docs/contributing.md)                      | Dev setup, testing, adding providers           |

## Development

```sh
npm install
npm test              # Run tests (vitest)
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
```
