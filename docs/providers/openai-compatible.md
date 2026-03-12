# OpenAI-Compatible Provider

The `openai-compatible` provider works with any API that implements the OpenAI chat completions or embeddings format. This includes Mistral (Codestral), OpenAI, and many other services.

## Completion Setup

### Codestral (Default)

The default autocomplete configuration uses Codestral via Mistral's API:

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
    }
  }
}
```

```sh
export MISTRAL_API_KEY="your-mistral-api-key"
```

### OpenAI

```json
{
  "models": {
    "gpt": {
      "provider": "openai-compatible",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "model": "gpt-4o",
      "apiKeyEnv": "OPENAI_API_KEY",
      "maxTokens": 256,
      "temperature": 0.0,
      "tasks": ["autocomplete"]
    }
  }
}
```

### Other OpenAI-Compatible Services

Any service that accepts the OpenAI chat completions format works. Set the `endpoint` to the service's completions URL and `apiKeyEnv` to the env var holding the API key.

## Embedding Setup

The default embedding model uses OpenAI's `text-embedding-3-small`:

```json
{
  "models": {
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

```sh
export OPENAI_API_KEY="your-openai-api-key"
```

## API Format

### Completions

Sends a `POST` request with:

- `model`: the configured model name
- `messages`: system prompt (with language-specific hints) + user prompt with fill-in-the-middle format
- `max_tokens`: from config
- `temperature`: from config
- `stop`: `["\n\n\n"]` to prevent runaway generation

Authentication: `Authorization: Bearer $API_KEY` header (key expanded from env var by the shell).

Expects a response with `choices[0].message.content` or `choices[0].text`.

### Embeddings

Sends a `POST` request with:

- `input`: array of text strings to embed
- `model`: the configured model name

Expects a response with `data[].embedding` arrays, sorted by `data[].index`.

## Supported Language Hints

The system prompt includes language-specific guidance for: TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, Ruby, PHP, Swift, Kotlin, C#, Lua, Shell, HTML, CSS, SQL, Zig, and Odin.
