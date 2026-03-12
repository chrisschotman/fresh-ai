const GHOST_NS = 'ai-ghost:';
const GHOST_R = 100;
const GHOST_G = 100;
const GHOST_B = 100;

let currentSuggestion: { bufferId: number; position: number; text: string } | null = null;

export async function showGhostText(bufferId: number, position: number, text: string): Promise<void> {
  clearGhostText(bufferId);

  const lines = text.split('\n');
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

  currentSuggestion = { bufferId, position, text };
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
