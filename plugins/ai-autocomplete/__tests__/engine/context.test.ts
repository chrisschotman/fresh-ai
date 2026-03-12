import { gatherContext } from '../../engine/context';

describe('gatherContext', () => {
  it('calls correct editor methods', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/src/app.ts');
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText).mockResolvedValue('some code');

    const ctx = await gatherContext(1, 100, 50);

    expect(editor.getBufferPath).toHaveBeenCalledWith(1);
    expect(editor.getBufferLength).toHaveBeenCalledWith(1);
    expect(editor.getBufferText).toHaveBeenCalledTimes(2);
    expect(ctx.filePath).toBe('/project/src/app.ts');
  });

  it('returns prefix and suffix text', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/main.ts');
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText)
      .mockResolvedValueOnce('prefix text')
      .mockResolvedValueOnce('suffix text');

    const ctx = await gatherContext(1, 100, 50);

    expect(ctx.prefix).toBe('prefix text');
    expect(ctx.suffix).toBe('suffix text');
  });

  it('detects language from file extension', async () => {
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    vi.mocked(editor.getBufferPath).mockReturnValue('/project/main.py');
    const ctx = await gatherContext(1, 100, 50);
    expect(ctx.language).toBe('python');
  });
});

describe('language detection', () => {
  const cases: [string, string][] = [
    ['.ts', 'typescript'],
    ['.tsx', 'typescript'],
    ['.js', 'javascript'],
    ['.jsx', 'javascript'],
    ['.py', 'python'],
    ['.rs', 'rust'],
    ['.go', 'go'],
    ['.java', 'java'],
    ['.c', 'c'],
    ['.cpp', 'cpp'],
    ['.h', 'c'],
    ['.hpp', 'cpp'],
    ['.rb', 'ruby'],
    ['.php', 'php'],
    ['.swift', 'swift'],
    ['.kt', 'kotlin'],
    ['.cs', 'csharp'],
    ['.lua', 'lua'],
    ['.sh', 'bash'],
    ['.zsh', 'bash'],
    ['.bash', 'bash'],
    ['.html', 'html'],
    ['.css', 'css'],
    ['.scss', 'scss'],
    ['.json', 'json'],
    ['.yaml', 'yaml'],
    ['.yml', 'yaml'],
    ['.toml', 'toml'],
    ['.xml', 'xml'],
    ['.sql', 'sql'],
    ['.zig', 'zig'],
    ['.odin', 'odin'],
    ['.vue', 'vue'],
    ['.svelte', 'svelte'],
  ];

  it.each(cases)('maps %s to %s', async (ext, lang) => {
    vi.mocked(editor.getBufferPath).mockReturnValue(`/project/file${ext}`);
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    const ctx = await gatherContext(1, 100, 50);
    expect(ctx.language).toBe(lang);
  });

  it('falls back to extension name for unknown extension', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/file.dart');
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    const ctx = await gatherContext(1, 100, 50);
    expect(ctx.language).toBe('dart');
  });

  it('falls back to text for no extension', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/Makefile');
    vi.mocked(editor.getBufferLength).mockReturnValue(500);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    const ctx = await gatherContext(1, 100, 50);
    expect(ctx.language).toBe('text');
  });
});

describe('byte offset clamping', () => {
  it('clamps negative offset to 0', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/main.ts');
    vi.mocked(editor.getBufferLength).mockReturnValue(100);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    await gatherContext(1, -10, 50);

    // prefix: getBufferText(1, 0, 0) — clamped to 0
    expect(editor.getBufferText).toHaveBeenCalledWith(1, 0, 0);
  });

  it('clamps offset beyond length', async () => {
    vi.mocked(editor.getBufferPath).mockReturnValue('/project/main.ts');
    vi.mocked(editor.getBufferLength).mockReturnValue(100);
    vi.mocked(editor.getBufferText).mockResolvedValue('');

    await gatherContext(1, 9999, 50);

    // suffix: getBufferText(1, 100, 100) — clamped
    expect(editor.getBufferText).toHaveBeenCalledWith(1, 100, 100);
  });
});
