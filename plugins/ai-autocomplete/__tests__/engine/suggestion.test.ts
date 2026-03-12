describe('suggestion', () => {
  let showGhostText: typeof import('../../engine/suggestion').showGhostText;
  let clearGhostText: typeof import('../../engine/suggestion').clearGhostText;
  let acceptSuggestion: typeof import('../../engine/suggestion').acceptSuggestion;
  let acceptWord: typeof import('../../engine/suggestion').acceptWord;
  let acceptLine: typeof import('../../engine/suggestion').acceptLine;
  let hasSuggestion: typeof import('../../engine/suggestion').hasSuggestion;
  let getCurrentSuggestion: typeof import('../../engine/suggestion').getCurrentSuggestion;
  let detectIndent: typeof import('../../engine/suggestion').detectIndent;
  let reindentSuggestion: typeof import('../../engine/suggestion').reindentSuggestion;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../engine/suggestion');
    showGhostText = mod.showGhostText;
    clearGhostText = mod.clearGhostText;
    acceptSuggestion = mod.acceptSuggestion;
    acceptWord = mod.acceptWord;
    acceptLine = mod.acceptLine;
    hasSuggestion = mod.hasSuggestion;
    getCurrentSuggestion = mod.getCurrentSuggestion;
    detectIndent = mod.detectIndent;
    reindentSuggestion = mod.reindentSuggestion;
  });

  describe('showGhostText', () => {
    it('clears existing ghost text first', async () => {
      await showGhostText(1, 50, 'hello');

      // First call should clear, then add
      expect(editor.removeVirtualTextsByPrefix).toHaveBeenCalledWith(1, 'ai-ghost:');
    });

    it('adds virtual text for the first line', async () => {
      await showGhostText(1, 50, 'completion text');

      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1,
        'ai-ghost:0',
        50,
        'completion text',
        100,
        100,
        100,
        false,
        false,
      );
    });

    it('renders ghost text on subsequent buffer lines for multi-line text', async () => {
      // Buffer after cursor: "rest of line\nsecond line\nthird line\n..."
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest of line\nsecond line\nthird line\nfourth line');

      await showGhostText(1, 50, 'line1\nline2\nline3');

      // First line at cursor position
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:0', 50, 'line1', 100, 100, 100, false, false,
      );
      // Second line at first newline offset (index 12)
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:1', 50 + 12, 'line2', 100, 100, 100, false, false,
      );
      // Third line at second newline offset (index 24)
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:2', 50 + 24, 'line3', 100, 100, 100, false, false,
      );
      expect(editor.setStatus).not.toHaveBeenCalled();
    });

    it('shows +M more lines only for lines exceeding available buffer lines', async () => {
      // Buffer only has 1 newline but suggestion has 3 lines (2 extra)
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest of line\nlast line');

      await showGhostText(1, 50, 'line1\nline2\nline3');

      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:0', 50, 'line1', 100, 100, 100, false, false,
      );
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:1', 50 + 12, 'line2', 100, 100, 100, false, false,
      );
      // line3 can't be placed — only 1 newline in buffer
      expect(editor.addVirtualText).toHaveBeenCalledTimes(2);
      expect(editor.setStatus).toHaveBeenCalledWith('AI: (+1 more lines)');
    });

    it('cursor at end of file — lines 2+ fall back to status', async () => {
      // No newlines after cursor
      vi.mocked(editor.getBufferLength).mockReturnValue(60);
      vi.mocked(editor.getBufferText).mockResolvedValue('end of file');

      await showGhostText(1, 50, 'line1\nline2\nline3');

      expect(editor.addVirtualText).toHaveBeenCalledTimes(1);
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:0', 50, 'line1', 100, 100, 100, false, false,
      );
      expect(editor.setStatus).toHaveBeenCalledWith('AI: (+2 more lines)');
    });

    it('empty lines in suggestion still work', async () => {
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest\n\nmore');

      await showGhostText(1, 50, 'first\n\nthird');

      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:0', 50, 'first', 100, 100, 100, false, false,
      );
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:1', 50 + 4, '', 100, 100, 100, false, false,
      );
      expect(editor.addVirtualText).toHaveBeenCalledWith(
        1, 'ai-ghost:2', 50 + 5, 'third', 100, 100, 100, false, false,
      );
    });

    it('single-line: no getBufferText call', async () => {
      await showGhostText(1, 50, 'single line');

      expect(editor.getBufferText).not.toHaveBeenCalled();
      expect(editor.setStatus).not.toHaveBeenCalled();
    });

    it('refreshes lines after adding', async () => {
      await showGhostText(1, 50, 'text');

      expect(editor.refreshLines).toHaveBeenCalledWith(1);
    });

    it('stores the suggestion', async () => {
      await showGhostText(1, 50, 'text');

      expect(hasSuggestion()).toBe(true);
      expect(getCurrentSuggestion()).toEqual({
        bufferId: 1,
        position: 50,
        text: 'text',
      });
    });
  });

  describe('clearGhostText', () => {
    it('removes virtual texts and refreshes', async () => {
      await showGhostText(1, 50, 'text');
      clearGhostText(1);

      expect(editor.removeVirtualTextsByPrefix).toHaveBeenCalledWith(1, 'ai-ghost:');
      expect(editor.refreshLines).toHaveBeenCalledWith(1);
    });

    it('nulls suggestion', async () => {
      await showGhostText(1, 50, 'text');
      clearGhostText(1);

      expect(hasSuggestion()).toBe(false);
      expect(getCurrentSuggestion()).toBeNull();
    });
  });

  describe('acceptSuggestion', () => {
    it('returns false when no suggestion', () => {
      expect(acceptSuggestion()).toBe(false);
    });

    it('inserts text and returns true when buffer+cursor match', async () => {
      await showGhostText(1, 50, 'completion');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      expect(acceptSuggestion()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('completion');
    });

    it('returns false on buffer mismatch', async () => {
      await showGhostText(1, 50, 'completion');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(2);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      expect(acceptSuggestion()).toBe(false);
      expect(editor.insertAtCursor).not.toHaveBeenCalled();
    });

    it('returns false on position mismatch', async () => {
      await showGhostText(1, 50, 'completion');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(99);

      expect(acceptSuggestion()).toBe(false);
      expect(editor.insertAtCursor).not.toHaveBeenCalled();
    });

    it('clears ghost text after accepting', async () => {
      await showGhostText(1, 50, 'completion');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      acceptSuggestion();

      expect(hasSuggestion()).toBe(false);
    });
  });

  describe('acceptWord', () => {
    it('returns false when no suggestion', () => {
      expect(acceptWord()).toBe(false);
    });

    it('accepts next word and keeps remainder as ghost text', async () => {
      await showGhostText(1, 50, 'hello world foo');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest\nmore\n');

      expect(acceptWord()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('hello');
      // Remaining ' world foo' should become new ghost text
    });

    it('accepts all when only one word left', async () => {
      await showGhostText(1, 50, 'hello');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      expect(acceptWord()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('hello');
    });

    it('includes leading whitespace with the word', async () => {
      await showGhostText(1, 50, '  hello world');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest\nmore\n');

      expect(acceptWord()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('  hello');
    });

    it('returns false on buffer mismatch', async () => {
      await showGhostText(1, 50, 'hello world');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(2);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      expect(acceptWord()).toBe(false);
    });
  });

  describe('acceptLine', () => {
    it('returns false when no suggestion', () => {
      expect(acceptLine()).toBe(false);
    });

    it('accepts first line and keeps rest as ghost text', async () => {
      await showGhostText(1, 50, 'first line\nsecond line\nthird');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);
      vi.mocked(editor.getBufferLength).mockReturnValue(5000);
      vi.mocked(editor.getBufferText).mockResolvedValue('rest\nmore\n');

      expect(acceptLine()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('first line\n');
    });

    it('accepts all for single-line suggestion', async () => {
      await showGhostText(1, 50, 'single line');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(50);

      expect(acceptLine()).toBe(true);
      expect(editor.insertAtCursor).toHaveBeenCalledWith('single line');
    });

    it('returns false on position mismatch', async () => {
      await showGhostText(1, 50, 'first\nsecond');

      vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
      vi.mocked(editor.getCursorPosition).mockReturnValue(99);

      expect(acceptLine()).toBe(false);
    });
  });

  describe('detectIndent', () => {
    it('detects spaces', () => {
      expect(detectIndent('    const x = 1;')).toEqual({ char: ' ', width: 4 });
    });

    it('detects tabs', () => {
      expect(detectIndent('\t\tconst x = 1;')).toEqual({ char: '\t', width: 2 });
    });

    it('returns zero for no indent', () => {
      expect(detectIndent('const x = 1;')).toEqual({ char: ' ', width: 0 });
    });

    it('returns zero for empty string', () => {
      expect(detectIndent('')).toEqual({ char: ' ', width: 0 });
    });
  });

  describe('reindentSuggestion', () => {
    it('returns single-line suggestions unchanged', () => {
      expect(reindentSuggestion('return x;', '    if (true) {')).toBe('return x;');
    });

    it('re-indents multi-line from 2-space to 4-space context', () => {
      const suggestion = 'firstLine\n  return x;\n  return y;';
      const result = reindentSuggestion(suggestion, '    if (true) {');
      expect(result).toBe('firstLine\n    return x;\n    return y;');
    });

    it('preserves relative indentation within suggestion', () => {
      const suggestion = 'first\n  if (x) {\n    return y;\n  }';
      const result = reindentSuggestion(suggestion, '      ');
      expect(result).toBe('first\n      if (x) {\n        return y;\n      }');
    });

    it('handles empty lines in suggestion', () => {
      const suggestion = 'first\n  line2\n\n  line4';
      const result = reindentSuggestion(suggestion, '    ');
      expect(result).toBe('first\n    line2\n\n    line4');
    });

    it('handles tab-indented context', () => {
      const suggestion = 'first\n  return x;';
      const result = reindentSuggestion(suggestion, '\t\tif (true) {');
      expect(result).toBe('first\n\t\treturn x;');
    });
  });

  describe('hasSuggestion / getCurrentSuggestion', () => {
    it('reflects current state', async () => {
      expect(hasSuggestion()).toBe(false);
      expect(getCurrentSuggestion()).toBeNull();

      await showGhostText(1, 50, 'text');

      expect(hasSuggestion()).toBe(true);
      expect(getCurrentSuggestion()).toEqual({
        bufferId: 1,
        position: 50,
        text: 'text',
      });
    });
  });
});
