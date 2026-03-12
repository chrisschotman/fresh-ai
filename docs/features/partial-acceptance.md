# Partial Suggestion Acceptance

Fresh-AI supports accepting suggestions incrementally -- by word or by line -- rather than inserting the entire suggestion at once.

## Accept Full Suggestion

**Command**: `ai_accept_suggestion` (AI: Accept Suggestion)

Inserts the entire ghost text suggestion at the cursor position and clears the ghost text.

## Accept Word

**Command**: `ai_accept_word` (AI: Accept Word)

Accepts the next word from the suggestion:

1. Matches the next whitespace + non-whitespace sequence (regex: `^\s*\S+`)
2. Inserts that word at the cursor
3. Updates the ghost text to show the remaining suggestion at the new cursor position
4. If no word boundary is found, accepts the entire remaining text

This allows fine-grained control when only part of a suggestion is useful.

## Accept Line

**Command**: `ai_accept_line` (AI: Accept Line)

Accepts up to and including the next newline from the suggestion:

1. Finds the first `\n` in the remaining suggestion
2. Inserts everything up to and including that newline
3. Updates the ghost text with remaining lines at the new cursor position
4. If no newline is found, accepts the entire remaining text

This is useful for multi-line suggestions where you want to review line-by-line.

## Ghost Text Rendering

Suggestions are displayed as virtual text (ghost text) in a muted grey color (RGB: 100, 100, 100):

- **First line**: Rendered inline at the cursor position
- **Subsequent lines**: Placed at newline positions in the buffer after the cursor
- If the suggestion has more lines than available newlines in the visible buffer area, a status message shows the overflow count: `AI: (+N more lines)`

## Indentation Intelligence

Multi-line suggestions are automatically re-indented to match the context:

1. The indentation style (tabs vs spaces) and depth of the current line is detected
2. The base indentation of the suggestion's second line is determined
3. All subsequent lines are re-indented relative to the context line's indentation
4. Empty lines are preserved as-is

This ensures pasted code matches your file's indentation style regardless of what the model generates.

## Cursor Position Validation

Before accepting any suggestion, the plugin verifies:

- The active buffer matches the buffer where the suggestion was generated
- The cursor offset matches the position where the suggestion was placed

If either check fails, the suggestion is silently cleared. This prevents inserting stale suggestions after the user has navigated away.
