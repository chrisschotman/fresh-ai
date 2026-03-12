# Anthropic Provider

The `anthropic` provider connects to the Anthropic Messages API for Claude-based completions.

## Setup

### 1. Get an API Key

Obtain an API key from [console.anthropic.com](https://console.anthropic.com).

### 2. Set the Environment Variable

```sh
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 3. Configure the Model

```json
{
  "models": {
    "claude": {
      "provider": "anthropic",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": 256,
      "temperature": 0.0,
      "tasks": ["autocomplete"]
    }
  }
}
```

## API Format

Sends a `POST` request with:

- `model`: the configured model name
- `max_tokens`: from config
- `temperature`: from config
- `system`: system prompt with language-specific coding hints
- `messages`: single user message with fill-in-the-middle prompt

Headers:

- `x-api-key: $ANTHROPIC_API_KEY` (expanded from env var by the shell)
- `anthropic-version: 2023-06-01`
- `Content-Type: application/json`

Expects a response with `content[0].text` where `content[0].type === "text"`.

## Notes

- The Anthropic provider is for **completions only**. There is no Anthropic embedding provider -- use `openai-compatible` or `ollama` for embeddings.
- The default model is `claude-sonnet-4-20250514`. Change the `model` field to use a different Claude model.
- Request timeout is 30 seconds (hardcoded in the curl command).

## Example: Claude with OpenAI Embeddings

A common setup pairs Claude for completions with OpenAI for embeddings:

```json
{
  "models": {
    "claude": {
      "provider": "anthropic",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": 256,
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

```sh
export ANTHROPIC_API_KEY="your-anthropic-key"
export OPENAI_API_KEY="your-openai-key"
```
