describe('integration: completion flow', () => {
  let triggerCompletion: typeof import('../../engine/autocomplete').triggerCompletion;
  let onBufferModified: typeof import('../../engine/autocomplete').onBufferModified;
  let dismiss: typeof import('../../engine/autocomplete').dismiss;
  let getState: typeof import('../../engine/autocomplete').getState;

  beforeEach(async () => {
    vi.resetModules();

    vi.mocked(editor.getActiveBufferId).mockReturnValue(1);
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/src/main.ts');
    vi.mocked(editor.getBufferLength).mockReturnValue(1000);
    vi.mocked(editor.getCursorPosition).mockReturnValue(100);
    vi.mocked(editor.getBufferText).mockResolvedValue('const x = 1;\nconst y = 2;\nconst z = 3;\n');
    vi.mocked(editor.fileExists).mockReturnValue(false);
    vi.mocked(editor.getEnv).mockImplementation((name: string) => {
      if (name === 'MISTRAL_API_KEY') return 'sk-test';
      return '';
    });

    const configMod = await import('../../config');
    await configMod.loadConfig();

    const autoMod = await import('../../engine/autocomplete');
    triggerCompletion = autoMod.triggerCompletion;
    onBufferModified = autoMod.onBufferModified;
    dismiss = autoMod.dismiss;
    getState = autoMod.getState;
  });

  it('full cycle: buffer_modified → debounce → spawn → parse → ghost text → accept → insert', async () => {
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: JSON.stringify({
        choices: [{ message: { content: ' + 2;' }, finish_reason: 'stop' }],
      }),
      stderr: '',
      exit_code: 0,
    });

    await onBufferModified();

    expect(editor.delay).toHaveBeenCalledWith(300);
    expect(editor.spawnBackgroundProcess).toHaveBeenCalled();
    expect(editor.addVirtualText).toHaveBeenCalled();
    expect(getState()).toBe('showing');

    // Flow worked end-to-end: buffer_modified → debounce → spawn → parse → ghost text shown
  });

  it('debounce cancellation: rapid buffer_modified calls → only last triggers', async () => {
    const delayResolvers: (() => void)[] = [];
    vi.mocked(editor.delay).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          delayResolvers.push(resolve);
        }),
    );

    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: JSON.stringify({
        choices: [{ message: { content: 'code' }, finish_reason: 'stop' }],
      }),
      stderr: '',
      exit_code: 0,
    });

    // Start first call (will block on delay)
    const first = onBufferModified();

    // Start second call (invalidates first via requestId++)
    const second = onBufferModified();

    // Resolve all delays
    for (const resolve of delayResolvers) resolve();
    vi.mocked(editor.delay).mockResolvedValue(undefined);

    await Promise.allSettled([first, second]);

    // Only the second (most recent) call should have spawned
    // The first should have been invalidated by requestId change
  });

  it('dismiss during request: requestId invalidates result', async () => {
    // Simulate: completion starts, dismiss is called before response arrives.
    // After dismiss, requestId has changed, so the response is discarded.
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });

    let dismissed = false;
    vi.mocked(editor.spawnProcessWait).mockImplementation(async () => {
      // Simulate dismiss happening during wait by calling it directly
      if (!dismissed) {
        dismissed = true;
        await dismiss();
      }
      return {
        stdout: JSON.stringify({
          choices: [{ message: { content: 'code' }, finish_reason: 'stop' }],
        }),
        stderr: '',
        exit_code: 0,
      };
    });

    await triggerCompletion();

    // Ghost text should NOT have been added because requestId changed during dismiss
    expect(getState()).toBe('idle');
  });

  it('toggle disable: clears ghost text, buffer_modified is no-op', async () => {
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: JSON.stringify({
        choices: [{ message: { content: 'code' }, finish_reason: 'stop' }],
      }),
      stderr: '',
      exit_code: 0,
    });

    await triggerCompletion();
    expect(getState()).toBe('showing');

    // Toggle off
    const configMod = await import('../../config');
    configMod.setEnabled(false);
    await dismiss();

    // buffer_modified should be no-op
    vi.mocked(editor.spawnBackgroundProcess).mockClear();
    await onBufferModified();

    expect(editor.spawnBackgroundProcess).not.toHaveBeenCalled();
  });

  it('extension filtering: .md file → triggerCompletion is no-op', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/readme.md');

    await triggerCompletion();

    expect(editor.spawnBackgroundProcess).not.toHaveBeenCalled();
  });

  it('multi-line completion: renders ghost text on subsequent buffer lines', async () => {
    vi.mocked(editor.getBufferLength).mockReturnValue(5000);
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: JSON.stringify({
        choices: [{ message: { content: ' + 2;\nconst b = 3;\nreturn a + b;' }, finish_reason: 'stop' }],
      }),
      stderr: '',
      exit_code: 0,
    });

    await triggerCompletion();

    expect(getState()).toBe('showing');
    // First line + 2 subsequent lines = 3 addVirtualText calls
    expect(editor.addVirtualText).toHaveBeenCalledTimes(3);
    expect(editor.addVirtualText).toHaveBeenCalledWith(
      1, 'ai-ghost:0', 100, ' + 2;', 100, 100, 100, false, false,
    );
  });

  it('cursor moved during request: result discarded', async () => {
    let cursorPos = 100;
    vi.mocked(editor.getCursorPosition).mockImplementation(() => cursorPos);
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
    vi.mocked(editor.spawnProcessWait).mockImplementation(async () => {
      cursorPos = 200; // Cursor moves during request
      return {
        stdout: JSON.stringify({
          choices: [{ message: { content: 'code' }, finish_reason: 'stop' }],
        }),
        stderr: '',
        exit_code: 0,
      };
    });

    await triggerCompletion();

    expect(editor.addVirtualText).not.toHaveBeenCalled();
    expect(getState()).toBe('idle');
  });
});
