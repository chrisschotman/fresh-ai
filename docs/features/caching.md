# Caching and Persistence

Fresh-AI persists its RAG embedding cache to disk so indexed data survives editor restarts.

## Cache Location

```
~/.config/rag-cache.json
```

The path is derived from `editor.getConfigDir()` + `rag-cache.json`.

## Cache Format

The persisted store is a JSON file with this structure:

```json
{
  "version": 1,
  "embeddingModel": "text-embedding-3-small",
  "embeddingProvider": "openai-compatible",
  "embeddingDimension": 1536,
  "configHash": "a1b2c3d4",
  "timestamp": 1709251200000,
  "files": [
    {
      "filePath": "/path/to/file.ts",
      "contentHash": "f8e7d6c5",
      "chunks": [
        {
          "content": "function example() { ... }",
          "embedding": [0.1, 0.2, ...],
          "startLine": 1,
          "endLine": 30,
          "scopeName": "example"
        }
      ]
    }
  ]
}
```

## Cache Invalidation

The cache is automatically invalidated (discarded) when:

1. **Config hash mismatch**: A hash of `provider:model:endpoint` is computed and compared to the stored `configHash`. If you change your embedding model, provider, or endpoint, the cache is discarded.

2. **Legacy fallback**: If no `configHash` is stored (older cache format), the `embeddingModel` and `embeddingProvider` fields are compared directly.

3. **Manual clear**: The `AI: Clear Cache` command clears all in-memory data. The `AI: Re-index Workspace` command clears and rebuilds from scratch.

## Content Hash Deduplication

Each file's content is hashed using FNV-1a (32-bit). When re-indexing:

- If the stored hash matches the current file content, the file is skipped
- This prevents redundant embedding API calls for unchanged files
- Hashes are updated on buffer save and workspace indexing

## Save Debouncing

Cache writes to disk are debounced to avoid excessive I/O:

1. After any change to the store (indexing, eviction), a save is scheduled
2. The save waits `rag.saveDebounceSec` seconds (default: 30)
3. If another change occurs during the wait, the timer resets
4. Only the latest generation's save actually writes to disk

## Atomic Writes

Cache files are written atomically:

1. Content is written to a `.tmp` file
2. The `.tmp` file is renamed to the final path using `mv`
3. This prevents corruption from partial writes or crashes

For large caches (over 100KB), the content is split into chunks and appended sequentially before the final rename.

## In-Memory Store Limits

- Maximum **500 chunks** total across all files
- LRU eviction removes the least recently accessed files' chunks when the limit is reached
- The store tracks access order -- both indexing and search results count as access

## Disabling Persistence

Set `rag.persistCache` to `false` in your config to keep embeddings in memory only:

```json
{
  "rag": {
    "persistCache": false
  }
}
```

The cache will be rebuilt from scratch on each editor restart.
