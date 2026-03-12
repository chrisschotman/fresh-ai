# Troubleshooting

## Enable Logging

Set `logVerbosity` in your config to see detailed status messages:

```json
{
  "logVerbosity": "verbose"
}
```

| Level       | Output                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `"off"`     | No logging (default)                                                   |
| `"minimal"` | Completion success/failure                                             |
| `"verbose"` | Completion timing, RAG search timing, embedding timing, indexing stats |

Reload after changing: run the `AI: Reload Config` command.

## Common Issues

### No suggestions appear

1. **Check if enabled**: Run `AI: Toggle Autocomplete` and look for the status message
2. **Check API key**: Ensure the env var is set (`echo $MISTRAL_API_KEY`)
3. **Check file extension**: `.md` and `.txt` are disabled by default. Check `disabledExtensions` in your config
4. **Check for empty prefix**: Suggestions are skipped if the text before the cursor is empty or whitespace-only
5. **Check debounce**: The default 300ms delay means you need to pause typing before a suggestion triggers

### "AI: No API key found in ..."

The env var specified in `apiKeyEnv` is not set or empty. Verify:

```sh
echo $MISTRAL_API_KEY  # or whatever your apiKeyEnv is set to
```

Note: Ollama does not require an API key. The plugin skips the key check when `provider` is `"ollama"`.

### "AI: request failed (exit N)"

Common curl exit codes:

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 6    | Could not resolve host                            |
| 7    | Failed to connect (server down or wrong endpoint) |
| 22   | HTTP error (400/401/403/429/500)                  |
| 28   | Timeout (requests have a 30-second limit)         |

For exit code 22, check:

- API key is valid and not expired
- Model name is correct for the provider
- You haven't exceeded rate limits

### "AI: Unknown provider ..."

The `provider` field in your model config doesn't match a registered provider. Valid values:

- `"openai-compatible"`
- `"anthropic"`
- `"ollama"`

### "AI: embedding dimension mismatch"

The stored embeddings have a different dimension than what the current model produces. This happens when switching embedding models. Fix:

1. Run `AI: Clear Cache`
2. Run `AI: Re-index Workspace`

### "AI: config parse error - using defaults"

The config file (`~/.config/ai-autocomplete.json`) contains invalid JSON. Validate it:

```sh
cat ~/.config/ai-autocomplete.json | python3 -m json.tool
```

### Suggestions appear but are low quality

- Increase `maxContextLines` to give the model more context (default: 50)
- Increase `maxTokens` for longer completions (default: 128, max: 4096)
- Enable RAG indexing to provide project-level context
- Try a different model (e.g., switch from Codellama to Codestral)

### Workspace indexing is slow

- Reduce `maxWorkspaceFiles` (default: 1000)
- Increase `indexBatchSize` to process more files per batch
- Reduce `indexBatchDelayMs` if you have API rate limit headroom
- Add file extensions to `disabledExtensions` to skip non-code files

### High API costs

- Reduce `maxWorkspaceFiles` to limit embedding API calls
- Set `rag.workspaceIndexing` to `false` to disable automatic indexing
- Enable `rag.persistCache` (default) so embeddings are reused across sessions
- Increase `debounceMs` to trigger fewer completions while typing

## Checking Stats

Run `AI: Show Stats` to see session metrics:

```
Completions: 42 (38 ok, 4 fail, avg 850ms) | RAG searches: 38 (avg 12ms) | Embeddings: 156 (2400ms total) | Files indexed: 23 (5200ms total)
```

High failure rates or slow averages can help identify provider issues.

## Resetting State

| Action           | Command                           | Effect                                                  |
| ---------------- | --------------------------------- | ------------------------------------------------------- |
| Clear embeddings | `AI: Clear Cache`                 | Removes all in-memory chunks and content hashes         |
| Rebuild index    | `AI: Re-index Workspace`          | Clears cache, re-discovers files, re-indexes everything |
| Reload config    | `AI: Reload Config`               | Re-reads config file, resets model configuration        |
| Toggle off/on    | `AI: Toggle Autocomplete` (twice) | Shuts down all processes, restarts from clean state     |
