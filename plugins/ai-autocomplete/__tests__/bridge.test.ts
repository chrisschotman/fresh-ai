import { shellEscape, spawnCancellable } from '../bridge';

describe('shellEscape', () => {
  it('wraps empty string in single quotes', () => {
    expect(shellEscape('')).toBe("''");
  });

  it('wraps a normal string in single quotes', () => {
    expect(shellEscape('hello')).toBe("'hello'");
  });

  it('escapes single quotes', () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  it('passes special chars through inside single quotes', () => {
    expect(shellEscape('$HOME && rm -rf /')).toBe("'$HOME && rm -rf /'");
  });

  it('handles newlines', () => {
    expect(shellEscape('line1\nline2')).toBe("'line1\nline2'");
  });

  it('handles multiple single quotes', () => {
    expect(shellEscape("a'b'c")).toBe("'a'\\''b'\\''c'");
  });

  it('handles backslashes', () => {
    expect(shellEscape('C:\\Users\\test')).toBe("'C:\\Users\\test'");
  });

  it('handles paths with spaces', () => {
    expect(shellEscape('/path/to/my file.ts')).toBe("'/path/to/my file.ts'");
  });

  it('handles unicode characters', () => {
    expect(shellEscape('hello\u00e9world')).toBe("'hello\u00e9world'");
  });

  it('handles backticks and dollar signs', () => {
    expect(shellEscape('`whoami` $USER')).toBe("'`whoami` $USER'");
  });

  it('handles semicolons and pipes', () => {
    expect(shellEscape('foo; bar | baz')).toBe("'foo; bar | baz'");
  });

  it('throws on null bytes', () => {
    expect(() => shellEscape('abc\0def')).toThrow('null byte');
  });
});

describe('spawnCancellable', () => {
  it('spawns via editor and returns process handle', async () => {
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 7 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: 'ok',
      stderr: '',
      exit_code: 0,
    });

    const handle = await spawnCancellable('echo hello');

    expect(editor.spawnBackgroundProcess).toHaveBeenCalledWith('sh', ['-c', 'echo hello'], '.');
    expect(handle.processId).toBe(7);
  });

  it('wait() maps result fields', async () => {
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 7 });
    vi.mocked(editor.spawnProcessWait).mockResolvedValue({
      stdout: 'output',
      stderr: 'err',
      exit_code: 1,
    });

    const handle = await spawnCancellable('failing cmd');
    const result = await handle.wait();

    expect(result).toEqual({
      stdout: 'output',
      stderr: 'err',
      exitCode: 1,
      processId: 7,
    });
  });

  it('cancel() kills the process', async () => {
    vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 9 });
    vi.mocked(editor.killProcess).mockResolvedValue(true);

    const handle = await spawnCancellable('long cmd');
    const killed = await handle.cancel();

    expect(editor.killProcess).toHaveBeenCalledWith(9);
    expect(killed).toBe(true);
  });
});
