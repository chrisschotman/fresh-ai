const GHOST_NS = 'ai-ghost:';
const GHOST_R = 100;
const GHOST_G = 100;
const GHOST_B = 100;

let currentSuggestion: { bufferId: number; position: number; text: string } | null = null;

interface IndentInfo {
  char: string;
  width: number;
}

export function detectIndent(line: string): IndentInfo {
  const match = /^(\s+)/.exec(line);
  if (match === null) return { char: ' ', width: 0 };
  const ws = match[1] ?? '';
  if (ws.includes('\t')) return { char: '\t', width: ws.length };
  return { char: ' ', width: ws.length };
}

export function reindentSuggestion(suggestion: string, contextLine: string): string {
  const lines = suggestion.split('\n');
  if (lines.length <= 1) return suggestion;

  const contextIndent = detectIndent(contextLine);
  const firstSuggestionLine = lines[1] ?? '';
  const baseIndent = detectIndent(firstSuggestionLine);

  // No re-indentation needed if suggestion has no indentation
  if (baseIndent.width === 0 && contextIndent.width === 0) return suggestion;

  // Re-indent lines 1+ relative to context
  const result = [lines[0] ?? ''];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineIndent = detectIndent(line);
    const relativeDepth = lineIndent.width - baseIndent.width;
    const newDepth = Math.max(0, contextIndent.width + relativeDepth);
    const stripped = line.trimStart();
    const newIndent = contextIndent.char.repeat(newDepth);
    result.push(stripped === '' ? '' : newIndent + stripped);
  }

  return result.join('\n');
}

export async function showGhostText(bufferId: number, position: number, text: string, contextLine?: string): Promise<void> {
  clearGhostText(bufferId);

  const reindented = contextLine !== undefined ? reindentSuggestion(text, contextLine) : text;
  const lines = reindented.split('\n');
  const firstLine = lines[0] ?? '';

  editor.addVirtualText(
    bufferId,
    GHOST_NS + '0',
    position,
    firstLine,
    GHOST_R,
    GHOST_G,
    GHOST_B,
    false,
    false,
  );

  if (lines.length > 1) {
    const bufferLength = editor.getBufferLength(bufferId);
    const chunkEnd = Math.min(position + 4096, bufferLength);
    const chunk = await editor.getBufferText(bufferId, position, chunkEnd);

    // Find newline positions in the buffer chunk
    const newlineOffsets: number[] = [];
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === '\n') {
        newlineOffsets.push(i);
      }
    }

    // Place virtual text at each newline position for remaining lines
    const placeable = Math.min(lines.length - 1, newlineOffsets.length);
    for (let k = 0; k < placeable; k++) {
      const nlOffset = newlineOffsets[k] ?? 0;
      const line = lines[k + 1] ?? '';
      editor.addVirtualText(
        bufferId,
        GHOST_NS + String(k + 1),
        position + nlOffset,
        line,
        GHOST_R,
        GHOST_G,
        GHOST_B,
        false,
        false,
      );
    }

    const overflow = lines.length - 1 - placeable;
    if (overflow > 0) {
      editor.setStatus(`AI: (+${String(overflow)} more lines)`);
    }
  }

  editor.refreshLines(bufferId);

  currentSuggestion = { bufferId, position, text: reindented };
}

export function clearGhostText(bufferId: number): void {
  editor.removeVirtualTextsByPrefix(bufferId, GHOST_NS);
  editor.refreshLines(bufferId);
  currentSuggestion = null;
}

export function acceptSuggestion(): boolean {
  if (currentSuggestion === null) return false;

  const { bufferId, position, text } = currentSuggestion;

  // Verify cursor is still at the suggestion position
  const currentBuffer = editor.getActiveBufferId();
  const currentOffset = editor.getCursorPosition();
  if (currentBuffer !== bufferId || currentOffset !== position) {
    clearGhostText(bufferId);
    return false;
  }

  clearGhostText(bufferId);
  editor.insertAtCursor(text);

  return true;
}

export function acceptWord(): boolean {
  if (currentSuggestion === null) return false;

  const { bufferId, position, text } = currentSuggestion;

  const currentBuffer = editor.getActiveBufferId();
  const currentOffset = editor.getCursorPosition();
  if (currentBuffer !== bufferId || currentOffset !== position) {
    clearGhostText(bufferId);
    return false;
  }

  // Find the end of the next word
  const wordMatch = /^\s*\S+/.exec(text);
  if (wordMatch === null) {
    // No word left — accept all
    clearGhostText(bufferId);
    editor.insertAtCursor(text);
    return true;
  }

  const accepted = wordMatch[0];
  const remaining = text.slice(accepted.length);

  clearGhostText(bufferId);
  editor.insertAtCursor(accepted);

  if (remaining === '') {
    return true;
  }

  // Update suggestion with remaining text at new cursor position
  const newPosition = position + accepted.length;
  void showGhostText(bufferId, newPosition, remaining);

  return true;
}

export function acceptLine(): boolean {
  if (currentSuggestion === null) return false;

  const { bufferId, position, text } = currentSuggestion;

  const currentBuffer = editor.getActiveBufferId();
  const currentOffset = editor.getCursorPosition();
  if (currentBuffer !== bufferId || currentOffset !== position) {
    clearGhostText(bufferId);
    return false;
  }

  const newlineIdx = text.indexOf('\n');
  const accepted = newlineIdx === -1 ? text : text.slice(0, newlineIdx + 1);
  const remaining = newlineIdx === -1 ? '' : text.slice(newlineIdx + 1);

  clearGhostText(bufferId);
  editor.insertAtCursor(accepted);

  if (remaining === '') {
    return true;
  }

  const newPosition = position + accepted.length;
  void showGhostText(bufferId, newPosition, remaining);

  return true;
}

export function hasSuggestion(): boolean {
  return currentSuggestion !== null;
}

export function getCurrentSuggestion(): {
  bufferId: number;
  position: number;
  text: string;
} | null {
  return currentSuggestion;
}
