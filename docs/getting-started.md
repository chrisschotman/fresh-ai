# Getting Started

## Requirements

- [Fresh](https://getfresh.dev) editor
- API key for at least one provider (Mistral, OpenAI, Anthropic) or a local Ollama instance
- `curl` available on your system PATH

## Installation

Clone the repository into your Fresh plugins directory:

```sh
git clone <repo-url> ~/.config/fresh/plugins/ai-autocomplete
```

## Initial Configuration

### 1. Set API Keys

The default configuration uses Codestral (Mistral) for completions and OpenAI for embeddings. Set the required environment variables:

```sh
# Required for autocomplete (default provider)
export MISTRAL_API_KEY="your-mistral-key"

# Required for RAG embeddings (default provider)
export OPENAI_API_KEY="your-openai-key"
```

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) for persistence.

### 2. (Optional) Create a Config File

The plugin works with sensible defaults out of the box. To customize behavior, create a config file:

```sh
touch ~/.config/ai-autocomplete.json
```

See [configuration.md](configuration.md) for all available options.

### 3. Restart Fresh

The plugin auto-initializes on startup. You should see a status message:

```
AI Autocomplete: loaded (openai-compatible/codestral-latest)
```

## Verify It Works

1. Open any source file (not `.md` or `.txt` -- those are disabled by default)
2. Start typing code
3. After a 300ms pause (the default debounce), a ghost text suggestion should appear in grey
4. Press **Tab** to accept the full suggestion
5. Run the command `AI: Show Stats` to confirm completions are being tracked

## Quick Troubleshooting

| Symptom                          | Check                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| No suggestions appear            | Verify your API key env var is set: `echo $MISTRAL_API_KEY` |
| "AI: No API key found" in status | The env var name in config doesn't match what's exported    |
| "AI: request failed (exit 7)"    | `curl` can't connect -- check your network/endpoint         |
| Suggestions on wrong file types  | Check `disabledExtensions` in your config                   |

For more, see [troubleshooting.md](troubleshooting.md).

## Next Steps

- [Configuration](configuration.md) -- all settings with defaults
- [Commands](commands.md) -- available commands and keybindings
- [Providers](providers/) -- setup guides for each provider
