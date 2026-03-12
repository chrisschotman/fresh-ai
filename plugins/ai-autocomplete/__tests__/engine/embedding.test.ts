describe('embedding', () => {
  let embed: typeof import('../../engine/embedding').embed;
  let embedBatch: typeof import('../../engine/embedding').embedBatch;

  beforeEach(async () => {
    vi.resetModules();

    vi.mocked(editor.fileExists).mockReturnValue(false);
    vi.mocked(editor.getEnv).mockImplementation((name: string) => {
      if (name === 'OPENAI_API_KEY') return 'sk-test';
      return '';
    });

    const configMod = await import('../../config');
    await configMod.loadConfig();

    const mod = await import('../../engine/embedding');
    embed = mod.embed;
    embedBatch = mod.embedBatch;
  });

  describe('embed', () => {
    it('returns embedding on success', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }] }),
        stderr: '',
        exit_code: 0,
      });

      const result = await embed('hello world');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(editor.spawnBackgroundProcess).toHaveBeenCalled();
    });

    it('returns null on failed request', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: '',
        stderr: 'error',
        exit_code: 1,
      });

      const result = await embed('hello world');

      expect(result).toBeNull();
    });

    it('returns null on invalid response', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: 'not json',
        stderr: '',
        exit_code: 0,
      });

      const result = await embed('hello world');

      expect(result).toBeNull();
    });

    it('returns null when no API key', async () => {
      vi.mocked(editor.getEnv).mockReturnValue('');

      vi.resetModules();
      const configMod = await import('../../config');
      await configMod.loadConfig();
      const mod = await import('../../engine/embedding');

      const result = await mod.embed('hello world');

      expect(result).toBeNull();
      expect(editor.spawnBackgroundProcess).not.toHaveBeenCalled();
    });

    it('returns null on spawn error', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockRejectedValue(new Error('spawn failed'));

      const result = await embed('hello world');

      expect(result).toBeNull();
    });
  });

  describe('embedBatch', () => {
    it('returns embeddings for batch input', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: JSON.stringify({
          data: [
            { embedding: [0.1, 0.2, 0.3], index: 0 },
            { embedding: [0.4, 0.5, 0.6], index: 1 },
          ],
        }),
        stderr: '',
        exit_code: 0,
      });

      const results = await embedBatch(['hello', 'world']);

      expect(results).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(editor.spawnBackgroundProcess).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for empty input', async () => {
      const results = await embedBatch([]);

      expect(results).toEqual([]);
      expect(editor.spawnBackgroundProcess).not.toHaveBeenCalled();
    });

    it('returns nulls on failed request', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: '',
        stderr: 'error',
        exit_code: 1,
      });

      const results = await embedBatch(['hello', 'world']);

      expect(results).toEqual([null, null]);
    });

    it('makes single HTTP call for multiple inputs', async () => {
      vi.mocked(editor.spawnBackgroundProcess).mockResolvedValue({ process_id: 42 });
      vi.mocked(editor.spawnProcessWait).mockResolvedValue({
        stdout: JSON.stringify({
          data: [
            { embedding: [0.1], index: 0 },
            { embedding: [0.2], index: 1 },
            { embedding: [0.3], index: 2 },
          ],
        }),
        stderr: '',
        exit_code: 0,
      });

      await embedBatch(['a', 'b', 'c']);

      expect(editor.spawnBackgroundProcess).toHaveBeenCalledTimes(1);
    });
  });
});
