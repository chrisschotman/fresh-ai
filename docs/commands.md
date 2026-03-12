# Commands

All commands are registered on plugin initialization and accessible through Fresh's command palette.

## Command Reference

| Command ID               | Label                   | Mode   | Description                                                                   |
| ------------------------ | ----------------------- | ------ | ----------------------------------------------------------------------------- |
| `ai_accept_suggestion`   | AI: Accept Suggestion   | insert | Accept the full ghost text suggestion and insert it at the cursor             |
| `ai_accept_word`         | AI: Accept Word         | insert | Accept the next word from the suggestion. Remaining text stays as ghost text  |
| `ai_accept_line`         | AI: Accept Line         | insert | Accept the next line from the suggestion. Remaining text stays as ghost text  |
| `ai_dismiss_suggestion`  | AI: Dismiss Suggestion  | insert | Dismiss the current ghost text suggestion                                     |
| `ai_toggle_autocomplete` | AI: Toggle Autocomplete | any    | Enable or disable autocomplete. When disabled, shuts down all active requests |
| `ai_trigger_completion`  | AI: Trigger Completion  | any    | Manually trigger a completion at the current cursor position                  |
| `ai_reload_config`       | AI: Reload Config       | any    | Reload configuration from `~/.config/ai-autocomplete.json`                    |
| `ai_show_stats`          | AI: Show Stats          | any    | Display session performance metrics in the status bar                         |
| `ai_clear_cache`         | AI: Clear Cache         | any    | Clear all in-memory RAG embeddings and content hashes                         |
| `ai_reindex_workspace`   | AI: Re-index Workspace  | any    | Clear cache and re-index all workspace files from scratch                     |

## Mode Explanation

- **insert**: Command is only available in insert mode (while typing)
- **any**: Command is available in all modes

## Keybindings

Commands are registered without hardcoded keybindings. Bind them in your Fresh keymap configuration. Recommended bindings:

```
Tab         -> ai_accept_suggestion    (in insert mode)
Ctrl+Right  -> ai_accept_word          (in insert mode)
Ctrl+Down   -> ai_accept_line          (in insert mode)
Escape      -> ai_dismiss_suggestion   (in insert mode)
```

## Event Handlers

The plugin also registers these internal event handlers. They are not user-callable commands but are listed for completeness:

| Event             | Handler                           | Description                                                        |
| ----------------- | --------------------------------- | ------------------------------------------------------------------ |
| `buffer_modified` | `ai_autocomplete_buffer_modified` | Debounces and triggers completion after typing                     |
| `cursor_moved`    | `ai_autocomplete_cursor_moved`    | Dismisses ghost text if cursor moves away from suggestion position |
| `buffer_saved`    | `ai_autocomplete_buffer_saved`    | Re-indexes the saved buffer and updates its content hash           |

## Stats Output

The `AI: Show Stats` command displays a single-line summary in the status bar:

```
Completions: 42 (38 ok, 4 fail, avg 850ms) | RAG searches: 38 (avg 12ms) | Embeddings: 156 (2400ms total) | Files indexed: 23 (5200ms total)
```

Metrics tracked per session:

- Completion requests, successes, failures, and average latency
- RAG similarity searches and average latency
- Embedding API calls and total time
- Files indexed and total indexing time
