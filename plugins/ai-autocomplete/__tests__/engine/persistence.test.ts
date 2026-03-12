import {
  hashContent,
  deserialize,
  shouldInvalidateCache,
  loadStore,
  getStorePath,
} from '../../engine/persistence';
import type { PersistedStore } from '../../engine/persistence';

vi.mock('../../bridge', () => ({
  writeFile: vi.fn(async () => true),
  shellEscape: vi.fn((s: string) => `'${s}'`),
  spawnCancellable: vi.fn(),
}));

describe('hashContent', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashContent('hello world');
    const hash2 = hashContent('hello world');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different input', () => {
    const hash1 = hashContent('hello');
    const hash2 = hashContent('world');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 8-char hex string', () => {
    const hash = hashContent('test');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles empty string', () => {
    const hash = hashContent('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('deserialize', () => {
  const validStore: PersistedStore = {
    version: 1,
    embeddingModel: 'text-embedding-3-small',
    embeddingProvider: 'openai-compatible',
    embeddingDimension: 1536,
    timestamp: Date.now(),
    files: [
      {
        filePath: '/test/file.ts',
        contentHash: 'abc12345',
        chunks: [
          {
            content: 'const x = 1;',
            embedding: [0.1, 0.2, 0.3],
            startLine: 1,
            endLine: 1,
          },
        ],
      },
    ],
  };

  it('round-trips valid store', () => {
    const json = JSON.stringify(validStore);
    const result = deserialize(json);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.embeddingModel).toBe('text-embedding-3-small');
    expect(result!.files).toHaveLength(1);
    expect(result!.files[0]!.chunks[0]!.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns null for invalid JSON', () => {
    expect(deserialize('not json')).toBeNull();
  });

  it('returns null for wrong version', () => {
    const bad = { ...validStore, version: 2 };
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for missing embeddingModel', () => {
    const { embeddingModel: _, ...bad } = validStore;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for missing embeddingProvider', () => {
    const { embeddingProvider: _, ...bad } = validStore;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for missing embeddingDimension', () => {
    const { embeddingDimension: _, ...bad } = validStore;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for missing files array', () => {
    const { files: _, ...bad } = validStore;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(deserialize('"string"')).toBeNull();
    expect(deserialize('null')).toBeNull();
    expect(deserialize('42')).toBeNull();
  });

  it('preserves scopeName in chunks', () => {
    const withScope = {
      ...validStore,
      files: [
        {
          filePath: '/test/file.ts',
          contentHash: 'abc',
          chunks: [
            {
              content: 'function foo() {}',
              embedding: [0.1],
              startLine: 1,
              endLine: 1,
              scopeName: 'foo',
            },
          ],
        },
      ],
    };
    const result = deserialize(JSON.stringify(withScope));
    expect(result!.files[0]!.chunks[0]!.scopeName).toBe('foo');
  });
});

describe('shouldInvalidateCache', () => {
  const store: PersistedStore = {
    version: 1,
    embeddingModel: 'text-embedding-3-small',
    embeddingProvider: 'openai-compatible',
    embeddingDimension: 1536,
    timestamp: Date.now(),
    files: [],
  };

  it('returns false when model and provider match', () => {
    expect(
      shouldInvalidateCache(store, {
        model: 'text-embedding-3-small',
        provider: 'openai-compatible',
      }),
    ).toBe(false);
  });

  it('returns true when model differs', () => {
    expect(
      shouldInvalidateCache(store, {
        model: 'text-embedding-3-large',
        provider: 'openai-compatible',
      }),
    ).toBe(true);
  });

  it('returns true when provider differs', () => {
    expect(
      shouldInvalidateCache(store, {
        model: 'text-embedding-3-small',
        provider: 'ollama',
      }),
    ).toBe(true);
  });
});

describe('loadStore', () => {
  it('returns null when file does not exist', async () => {
    vi.mocked(editor.fileExists).mockReturnValue(false);
    const result = await loadStore();
    expect(result).toBeNull();
  });

  it('returns parsed store when file is valid', async () => {
    const validStore: PersistedStore = {
      version: 1,
      embeddingModel: 'model',
      embeddingProvider: 'provider',
      embeddingDimension: 3,
      timestamp: Date.now(),
      files: [],
    };
    vi.mocked(editor.fileExists).mockReturnValue(true);
    vi.mocked(editor.readFile).mockResolvedValue(JSON.stringify(validStore));

    const result = await loadStore();
    expect(result).not.toBeNull();
    expect(result!.embeddingModel).toBe('model');
  });

  it('returns null on corrupt file', async () => {
    vi.mocked(editor.fileExists).mockReturnValue(true);
    vi.mocked(editor.readFile).mockResolvedValue('corrupt data');

    const result = await loadStore();
    expect(result).toBeNull();
  });

  it('returns null on read error', async () => {
    vi.mocked(editor.fileExists).mockReturnValue(true);
    vi.mocked(editor.readFile).mockRejectedValue(new Error('read failed'));

    const result = await loadStore();
    expect(result).toBeNull();
  });
});

describe('getStorePath', () => {
  it('builds path using editor config dir', () => {
    vi.mocked(editor.getConfigDir).mockReturnValue('/home/user/.config/fresh');
    vi.mocked(editor.pathJoin).mockImplementation((parts: string[]) => parts.join('/'));

    const path = getStorePath();
    expect(path).toBe('/home/user/.config/fresh/rag-cache.json');
  });
});
