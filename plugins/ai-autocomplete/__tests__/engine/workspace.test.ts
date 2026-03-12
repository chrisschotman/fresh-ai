vi.mock('../../engine/embedding', () => ({
  embed: vi.fn(),
  embedBatch: vi.fn(),
}));

vi.mock('../../bridge', () => ({
  shellEscape: vi.fn((s: string) => `'${s}'`),
  spawnCancellable: vi.fn(),
  writeFile: vi.fn(async () => true),
}));

describe('workspace', () => {
  let discoverFiles: typeof import('../../engine/workspace').discoverFiles;
  let indexFile: typeof import('../../engine/workspace').indexFile;
  let indexWorkspace: typeof import('../../engine/workspace').indexWorkspace;
  let getProjectRoot: typeof import('../../engine/workspace').getProjectRoot;
  let resetProjectRoot: typeof import('../../engine/workspace').resetProjectRoot;
  let spawnCancellableMock: ReturnType<typeof vi.fn>;
  let embedBatchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    const bridge = await import('../../bridge');
    spawnCancellableMock = vi.mocked(bridge.spawnCancellable);

    const embedding = await import('../../engine/embedding');
    embedBatchMock = vi.mocked(embedding.embedBatch);

    const ws = await import('../../engine/workspace');
    discoverFiles = ws.discoverFiles;
    indexFile = ws.indexFile;
    indexWorkspace = ws.indexWorkspace;
    getProjectRoot = ws.getProjectRoot;
    resetProjectRoot = ws.resetProjectRoot;

    // Clear RAG store
    const rag = await import('../../engine/rag');
    rag.clearStore();

    resetProjectRoot();
  });

  describe('getProjectRoot', () => {
    it('returns git root on success', async () => {
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({ stdout: '/project\n', stderr: '', exitCode: 0, processId: 1 }),
        cancel: async () => true,
      });

      const root = await getProjectRoot();
      expect(root).toBe('/project');
    });

    it('returns null on git failure', async () => {
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({ stdout: '', stderr: 'not a repo', exitCode: 128, processId: 1 }),
        cancel: async () => true,
      });

      const root = await getProjectRoot();
      expect(root).toBeNull();
    });

    it('caches result', async () => {
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({ stdout: '/project\n', stderr: '', exitCode: 0, processId: 1 }),
        cancel: async () => true,
      });

      await getProjectRoot();
      await getProjectRoot();
      expect(spawnCancellableMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('discoverFiles', () => {
    it('discovers files via git ls-files', async () => {
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({
          stdout: 'src/main.ts\nsrc/utils.ts\nREADME.md\n',
          stderr: '',
          exitCode: 0,
          processId: 1,
        }),
        cancel: async () => true,
      });

      const files = await discoverFiles('/project', ['.md'], 1000);
      // README.md should be filtered out
      expect(files).toHaveLength(2);
      expect(files[0]).toContain('main.ts');
      expect(files[1]).toContain('utils.ts');
    });

    it('caps at maxFiles', async () => {
      const manyFiles = Array.from({ length: 50 }, (_, i) => `file${String(i)}.ts`).join('\n');
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({ stdout: manyFiles, stderr: '', exitCode: 0, processId: 1 }),
        cancel: async () => true,
      });

      const files = await discoverFiles('/project', [], 10);
      expect(files).toHaveLength(10);
    });

    it('returns empty on complete failure', async () => {
      spawnCancellableMock.mockRejectedValue(new Error('spawn failed'));

      const files = await discoverFiles('/project', [], 1000);
      expect(files).toEqual([]);
    });
  });

  describe('indexFile', () => {
    it('indexes a file and returns true', async () => {
      vi.mocked(editor.readFile).mockResolvedValue('const x = 1;\nconst y = 2;\n');
      embedBatchMock.mockResolvedValue([[0.1, 0.2, 0.3]]);

      const result = await indexFile('/project/test.ts');
      expect(result).toBe(true);
    });

    it('skips unchanged files', async () => {
      vi.mocked(editor.readFile).mockResolvedValue('const x = 1;\n');
      embedBatchMock.mockResolvedValue([[0.1, 0.2, 0.3]]);

      // Index first time
      await indexFile('/project/test.ts');
      embedBatchMock.mockClear();

      // Index again — should skip
      const result = await indexFile('/project/test.ts');
      expect(result).toBe(false);
      expect(embedBatchMock).not.toHaveBeenCalled();
    });

    it('returns false for empty files', async () => {
      vi.mocked(editor.readFile).mockResolvedValue('   ');

      const result = await indexFile('/project/test.ts');
      expect(result).toBe(false);
    });

    it('returns false on read error', async () => {
      vi.mocked(editor.readFile).mockRejectedValue(new Error('not found'));

      const result = await indexFile('/project/test.ts');
      expect(result).toBe(false);
    });
  });

  describe('indexWorkspace', () => {
    it('indexes discovered files in batches', async () => {
      // First call: getProjectRoot
      let callCount = 0;
      spawnCancellableMock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // getProjectRoot
          return {
            processId: 1,
            wait: async () => ({ stdout: '/project\n', stderr: '', exitCode: 0, processId: 1 }),
            cancel: async () => true,
          };
        }
        // discoverFiles (git ls-files)
        return {
          processId: 2,
          wait: async () => ({
            stdout: 'a.ts\nb.ts\nc.ts\n',
            stderr: '',
            exitCode: 0,
            processId: 2,
          }),
          cancel: async () => true,
        };
      });

      vi.mocked(editor.readFile).mockResolvedValue('const x = 1;\n');
      embedBatchMock.mockResolvedValue([[0.1, 0.2, 0.3]]);

      await indexWorkspace(
        {
          persistCache: false,
          workspaceIndexing: true,
          maxWorkspaceFiles: 100,
          chunkTargetLines: 30,
          chunkOverlapLines: 5,
          chunkRespectBoundaries: true,
          indexBatchSize: 2,
          indexBatchDelayMs: 0,
          saveDebounceSec: 30,
        },
        [],
      );

      expect(editor.setStatus).toHaveBeenCalledWith(expect.stringContaining('indexed'));
    });

    it('does nothing when no project root', async () => {
      spawnCancellableMock.mockResolvedValue({
        processId: 1,
        wait: async () => ({ stdout: '', stderr: '', exitCode: 128, processId: 1 }),
        cancel: async () => true,
      });

      await indexWorkspace(
        {
          persistCache: false,
          workspaceIndexing: true,
          maxWorkspaceFiles: 100,
          chunkTargetLines: 30,
          chunkOverlapLines: 5,
          chunkRespectBoundaries: true,
          indexBatchSize: 5,
          indexBatchDelayMs: 0,
          saveDebounceSec: 30,
        },
        [],
      );

      // Should not attempt to index
      expect(embedBatchMock).not.toHaveBeenCalled();
    });
  });
});
