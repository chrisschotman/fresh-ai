describe('main', () => {
  beforeEach(async () => {
    vi.resetModules();

    vi.mocked(editor.fileExists).mockReturnValue(false);
    vi.mocked(editor.getEnv).mockReturnValue('');

    // Import main to trigger init
    await import('../main');

    // Allow microtasks (init is void-called)
    await vi.advanceTimersByTimeAsync?.(0).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
  });

  it('loads config on init', () => {
    expect(editor.getConfigDir).toHaveBeenCalled();
  });

  it('registers 2 event listeners', () => {
    expect(editor.on).toHaveBeenCalledWith('buffer_modified', 'ai_autocomplete_buffer_modified');
    expect(editor.on).toHaveBeenCalledWith('cursor_moved', 'ai_autocomplete_cursor_moved');
  });

  it('registers 6 commands', () => {
    expect(editor.registerCommand).toHaveBeenCalledTimes(6);

    const calls = vi.mocked(editor.registerCommand).mock.calls;
    const commandIds = calls.map((c) => c[0]);

    expect(commandIds).toContain('ai_accept_suggestion');
    expect(commandIds).toContain('ai_dismiss_suggestion');
    expect(commandIds).toContain('ai_toggle_autocomplete');
    expect(commandIds).toContain('ai_trigger_completion');
    expect(commandIds).toContain('ai_reload_config');
    expect(commandIds).toContain('ai_reindex_workspace');
  });

  it('sets status after init', () => {
    expect(editor.setStatus).toHaveBeenCalledWith(
      expect.stringContaining('AI Autocomplete: loaded'),
    );
  });

  it('exposes buffer_modified handler on globalThis', () => {
    expect(typeof globalThis.ai_autocomplete_buffer_modified).toBe('function');
  });

  it('exposes cursor_moved handler on globalThis', () => {
    expect(typeof globalThis.ai_autocomplete_cursor_moved).toBe('function');
  });

  it('exposes command handlers on globalThis', () => {
    expect(typeof globalThis.ai_autocomplete_accept).toBe('function');
    expect(typeof globalThis.ai_autocomplete_dismiss).toBe('function');
    expect(typeof globalThis.ai_autocomplete_toggle).toBe('function');
    expect(typeof globalThis.ai_autocomplete_trigger).toBe('function');
    expect(typeof globalThis.ai_autocomplete_reload_config).toBe('function');
  });
});
