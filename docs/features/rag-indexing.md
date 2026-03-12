# RAG Workspace Indexing

Fresh-AI uses Retrieval-Augmented Generation (RAG) to provide context-aware completions. It indexes your workspace files, generates embeddings, and retrieves semantically relevant code snippets to include in completion prompts.

## How It Works

### 1. File Discovery

On startup (if `rag.workspaceIndexing` is `true`), the plugin discovers files to index:

1. Runs `git ls-files` from the project root to get tracked files
2. Falls back to `find` (excluding `node_modules/` and `.git/`) if not in a git repo
3. Filters out files with extensions in `disabledExtensions` (default: `.md`, `.txt`)
4. Caps the file list at `rag.maxWorkspaceFiles` (default: 1000)

The project root is determined by `git rev-parse --show-toplevel`.

### 2. Chunking

Each file is split into chunks for embedding. The chunking algorithm:

- **Target size**: `rag.chunkTargetLines` lines per chunk (default: 30)
- **Overlap**: `rag.chunkOverlapLines` lines overlap between consecutive chunks (default: 5)
- **Boundary snapping**: When `rag.chunkRespectBoundaries` is `true` (default), chunk boundaries snap to nearby code structure boundaries (within 5 lines of the target end)

Recognized boundaries include function/class/interface/type/enum declarations in: TypeScript, JavaScript, Python, Rust, Go, and other common languages.

Each chunk records:

- File path and line range
- Content text
- Scope name (e.g., function or class name, if detected)

### 3. Embedding

Chunks are sent to the embedding model in batches of `rag.indexBatchSize` (default: 5) with `rag.indexBatchDelayMs` (default: 100ms) delay between batches to avoid rate limiting.

### 4. Similarity Search

When a completion is triggered, the current code prefix is embedded and compared against all stored chunks using **cosine similarity**. The top 3 most relevant chunks are retrieved and included in the completion prompt as context.

### 5. Storage

The in-memory vector store:

- Holds up to **500 chunks** total (hardcoded `MAX_CHUNKS`)
- Uses **LRU eviction** -- when the store is full, the least recently accessed files' chunks are removed first
- "Access" means either indexing a file or having its chunks appear in a top-K search result

## Content Hashing

Each indexed file's content is hashed using FNV-1a. On re-indexing (startup or save), files are skipped if their content hash hasn't changed, avoiding redundant embedding API calls.

## Batched Indexing

Workspace indexing processes files in configurable batches:

1. Discover all files
2. Process `indexBatchSize` files in parallel
3. Wait `indexBatchDelayMs` between batches
4. Report total files indexed and time taken

## On-Save Re-indexing

When a buffer is saved:

1. The file's existing chunks are removed from the store
2. The buffer content is re-chunked and re-embedded
3. The content hash is updated so the workspace indexer skips this file

## Related Configuration

See [configuration.md](../configuration.md) for the full `rag` config block.

## Commands

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `AI: Re-index Workspace` | Clear cache and re-index all workspace files |
| `AI: Clear Cache`        | Clear all in-memory embeddings               |
