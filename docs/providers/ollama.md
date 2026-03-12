# Ollama Provider

The `ollama` provider connects to a local [Ollama](https://ollama.ai) instance. No API key is required.

## Prerequisites

1. Install Ollama: https://ollama.ai
2. Pull a code completion model:
   ```sh
   ollama pull codellama
   ```
3. Ensure Ollama is running (default: `http://localhost:11434`)

## Completion Setup

```json
{
  "models": {
    "local": {
      "provider": "ollama",
      "endpoint": "http://localhost:11434/api/generate",
      "model": "codellama",
      "apiKeyEnv": "NONE",
      "maxTokens": 128,
      "temperature": 0.0,
      "tasks": ["autocomplete"]
    }
  }
}
```

The `apiKeyEnv` field is required by the config schema but is not used for Ollama. Set it to any valid env var name (e.g., `"NONE"`).

### Recommended Models

| Model            | Size      | Notes                                  |
| ---------------- | --------- | -------------------------------------- |
| `codellama`      | 7B        | Good general-purpose code completion   |
| `codellama:13b`  | 13B       | Better quality, slower                 |
| `codellama:34b`  | 34B       | Best quality, requires significant RAM |
| `deepseek-coder` | 6.7B      | Strong code completion                 |
| `starcoder2`     | 3B/7B/15B | Trained on code, multiple sizes        |

## Embedding Setup

Ollama also supports local embeddings via the `/api/embed` endpoint:

```json
{
  "models": {
    "local-embedder": {
      "provider": "ollama",
      "endpoint": "http://localhost:11434/api/embed",
      "model": "nomic-embed-text",
      "apiKeyEnv": "NONE",
      "maxTokens": 0,
      "temperature": 0.0,
      "tasks": ["embedding"]
    }
  }
}
```

```sh
ollama pull nomic-embed-text
```

## Fully Local Setup

Use Ollama for both completions and embeddings with no external API calls:

```json
{
  "models": {
    "local": {
      "provider": "ollama",
      "endpoint": "http://localhost:11434/api/generate",
      "model": "codellama",
      "apiKeyEnv": "NONE",
      "maxTokens": 128,
      "temperature": 0.0,
      "tasks": ["autocomplete"]
    },
    "local-embedder": {
      "provider": "ollama",
      "endpoint": "http://localhost:11434/api/embed",
      "model": "nomic-embed-text",
      "apiKeyEnv": "NONE",
      "maxTokens": 0,
      "temperature": 0.0,
      "tasks": ["embedding"]
    }
  }
}
```

## API Format

### Completions

Sends a `POST` to `/api/generate` with:

- `model`: the configured model name
- `prompt`: prefix text (with optional RAG context prepended)
- `suffix`: suffix text for fill-in-the-middle
- `stream`: `false`
- `options.num_predict`: maxTokens
- `options.temperature`: temperature
- `options.stop`: `["\n\n\n"]`

No authentication headers are sent.

### Embeddings

Sends a `POST` to `/api/embed` with:

- `model`: the configured model name
- `input`: array of text strings

Expects `embeddings[][]` in the response.

## Troubleshooting

| Issue              | Solution                                                    |
| ------------------ | ----------------------------------------------------------- |
| Connection refused | Ensure Ollama is running: `ollama serve`                    |
| Model not found    | Pull the model first: `ollama pull codellama`               |
| Slow responses     | Use a smaller model or ensure sufficient RAM                |
| Empty completions  | Try a different model -- some handle FIM better than others |
