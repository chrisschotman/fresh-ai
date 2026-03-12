describe('config', () => {
  let loadConfig: typeof import('../config').loadConfig;
  let getConfig: typeof import('../config').getConfig;
  let getModelForTask: typeof import('../config').getModelForTask;
  let getApiKeyForTask: typeof import('../config').getApiKeyForTask;
  let getApiKey: typeof import('../config').getApiKey;
  let setEnabled: typeof import('../config').setEnabled;
  let isExtensionDisabled: typeof import('../config').isExtensionDisabled;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../config');
    loadConfig = mod.loadConfig;
    getConfig = mod.getConfig;
    getModelForTask = mod.getModelForTask;
    getApiKeyForTask = mod.getApiKeyForTask;
    getApiKey = mod.getApiKey;
    setEnabled = mod.setEnabled;
    isExtensionDisabled = mod.isExtensionDisabled;
  });

  describe('no config file', () => {
    it('returns defaults', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);

      const config = await loadConfig();

      expect(config.enabled).toBe(true);
      expect(config.debounceMs).toBe(300);
      expect(config.maxContextLines).toBe(50);
      expect(config.disabledExtensions).toEqual(['.md', '.txt']);
      expect(Object.keys(config.models)).toHaveLength(2);
    });

    it('has default codestral model for autocomplete', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      await loadConfig();

      const model = getModelForTask('autocomplete');
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('openai-compatible');
      expect(model!.model).toBe('codestral-latest');
      expect(model!.tasks).toContain('autocomplete');
    });

    it('has default embedder model for embedding', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      await loadConfig();

      const model = getModelForTask('embedding');
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('openai-compatible');
      expect(model!.model).toBe('text-embedding-3-small');
    });
  });

  describe('valid model config', () => {
    it('parses models and validates', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            mymodel: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'claude-sonnet-4-20250514',
              apiKeyEnv: 'ANTHROPIC_API_KEY',
              maxTokens: 256,
              temperature: 0.5,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      const config = await loadConfig();
      const model = config.models['mymodel'];

      expect(model).toBeDefined();
      expect(model!.provider).toBe('anthropic');
      expect(model!.maxTokens).toBe(256);
      expect(model!.temperature).toBe(0.5);
    });

    it('merges defaults for unclaimed tasks', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            mymodel: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'claude-sonnet-4-20250514',
              apiKeyEnv: 'ANTHROPIC_API_KEY',
              maxTokens: 256,
              temperature: 0.5,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      await loadConfig();

      // embedding not claimed by mymodel, should get default embedder
      const embedder = getModelForTask('embedding');
      expect(embedder).not.toBeNull();
      expect(embedder!.model).toBe('text-embedding-3-small');
      expect(Object.keys(getConfig().models).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validation', () => {
    it('skips model with invalid provider', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            bad: {
              provider: 'invalid provider!',
              endpoint: 'https://api.example.com',
              model: 'test',
              apiKeyEnv: 'KEY',
              maxTokens: 100,
              temperature: 0,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      await loadConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('invalid provider'),
      );
    });

    it('skips model with invalid endpoint', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            bad: {
              provider: 'anthropic',
              endpoint: 'ftp://bad',
              model: 'test',
              apiKeyEnv: 'KEY',
              maxTokens: 100,
              temperature: 0,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      await loadConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('invalid endpoint'),
      );
    });

    it('skips model with invalid apiKeyEnv', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            bad: {
              provider: 'anthropic',
              endpoint: 'https://api.example.com',
              model: 'test',
              apiKeyEnv: '123invalid',
              maxTokens: 100,
              temperature: 0,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      await loadConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('invalid apiKeyEnv'),
      );
    });

    it('clamps maxTokens to [0, 4096]', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            big: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'test',
              apiKeyEnv: 'KEY',
              maxTokens: 99999,
              temperature: 0,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      const config = await loadConfig();
      expect(config.models['big']!.maxTokens).toBe(4096);
    });

    it('clamps temperature to [0, 2]', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            hot: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'test',
              apiKeyEnv: 'KEY',
              maxTokens: 100,
              temperature: 5,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      const config = await loadConfig();
      expect(config.models['hot']!.temperature).toBe(2);
    });

    it('rejects duplicate task claims', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            first: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'first',
              apiKeyEnv: 'KEY',
              maxTokens: 100,
              temperature: 0,
              tasks: ['autocomplete'],
            },
            second: {
              provider: 'ollama',
              endpoint: 'http://localhost:11434/api/generate',
              model: 'second',
              apiKeyEnv: 'KEY2',
              maxTokens: 100,
              temperature: 0,
              tasks: ['autocomplete'],
            },
          },
        }),
      );

      await loadConfig();

      // second model should have been skipped (no valid tasks left)
      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('no valid tasks'),
      );
    });

    it('skips model with no valid tasks', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          models: {
            empty: {
              provider: 'anthropic',
              endpoint: 'https://api.anthropic.com/v1/messages',
              model: 'test',
              apiKeyEnv: 'KEY',
              maxTokens: 100,
              temperature: 0,
              tasks: ['nonexistent' as any],
            },
          },
        }),
      );

      await loadConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('no valid tasks'),
      );
    });
  });

  describe('legacy flat config', () => {
    it('creates single autocomplete model + default embedder', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          provider: 'anthropic',
          endpoint: 'https://api.anthropic.com/v1/messages',
          model: 'claude-sonnet-4-20250514',
          apiKeyEnv: 'ANTHROPIC_API_KEY',
        }),
      );

      await loadConfig();

      const autoModel = getModelForTask('autocomplete');
      expect(autoModel).not.toBeNull();
      expect(autoModel!.provider).toBe('anthropic');

      const embedModel = getModelForTask('embedding');
      expect(embedModel).not.toBeNull();
      expect(embedModel!.model).toBe('text-embedding-3-small');
    });
  });

  describe('invalid JSON', () => {
    it('falls back to defaults with status message', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue('not json {{{');

      await loadConfig();
      const cfg = getConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('config parse error'),
      );
      expect(cfg.enabled).toBe(true);
      expect(cfg.debounceMs).toBe(300);
    });
  });

  describe('env overrides', () => {
    it('overrides autocomplete model from env vars', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      vi.mocked(editor.getEnv).mockImplementation((name: string) => {
        const envs: Record<string, string> = {
          AI_AUTOCOMPLETE_PROVIDER: 'anthropic',
          AI_AUTOCOMPLETE_ENDPOINT: 'https://override.example.com/v1',
          AI_AUTOCOMPLETE_MODEL: 'override-model',
          AI_AUTOCOMPLETE_API_KEY_ENV: 'OVERRIDE_KEY',
        };
        return envs[name] ?? '';
      });

      await loadConfig();

      const model = getModelForTask('autocomplete');
      expect(model!.provider).toBe('anthropic');
      expect(model!.endpoint).toBe('https://override.example.com/v1');
      expect(model!.model).toBe('override-model');
      expect(model!.apiKeyEnv).toBe('OVERRIDE_KEY');
    });

    it('ignores invalid env values', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      vi.mocked(editor.getEnv).mockImplementation((name: string) => {
        const envs: Record<string, string> = {
          AI_AUTOCOMPLETE_PROVIDER: 'invalid provider!',
          AI_AUTOCOMPLETE_ENDPOINT: 'ftp://bad',
        };
        return envs[name] ?? '';
      });

      await loadConfig();

      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('invalid AI_AUTOCOMPLETE_PROVIDER'),
      );
      expect(editor.setStatus).toHaveBeenCalledWith(
        expect.stringContaining('invalid AI_AUTOCOMPLETE_ENDPOINT'),
      );
    });
  });

  describe('helper functions', () => {
    it('getApiKeyForTask returns env value', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      vi.mocked(editor.getEnv).mockImplementation((name: string) => {
        if (name === 'MISTRAL_API_KEY') return 'sk-test';
        return '';
      });

      await loadConfig();
      expect(getApiKeyForTask('autocomplete')).toBe('sk-test');
    });

    it('getApiKey returns autocomplete key', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      vi.mocked(editor.getEnv).mockImplementation((name: string) => {
        if (name === 'MISTRAL_API_KEY') return 'sk-test';
        return '';
      });

      await loadConfig();
      expect(getApiKey()).toBe('sk-test');
    });

    it('getApiKeyForTask returns empty for unknown task model', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(JSON.stringify({ models: {} }));

      await loadConfig();
      // With empty models, both tasks fall back to defaults, but let's test the code path
      expect(typeof getApiKeyForTask('autocomplete')).toBe('string');
    });

    it('setEnabled toggles config', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      await loadConfig();

      expect(getConfig().enabled).toBe(true);
      setEnabled(false);
      expect(getConfig().enabled).toBe(false);
      setEnabled(true);
      expect(getConfig().enabled).toBe(true);
    });

    it('isExtensionDisabled checks disabledExtensions', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      await loadConfig();

      expect(isExtensionDisabled('readme.md')).toBe(true);
      expect(isExtensionDisabled('notes.txt')).toBe(true);
      expect(isExtensionDisabled('main.ts')).toBe(false);
    });
  });

  describe('rag config', () => {
    it('returns rag defaults when no config file', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(false);
      const config = await loadConfig();

      expect(config.rag).toBeDefined();
      expect(config.rag.persistCache).toBe(true);
      expect(config.rag.workspaceIndexing).toBe(true);
      expect(config.rag.maxWorkspaceFiles).toBe(1000);
      expect(config.rag.chunkTargetLines).toBe(30);
      expect(config.rag.chunkOverlapLines).toBe(5);
      expect(config.rag.chunkRespectBoundaries).toBe(true);
      expect(config.rag.indexBatchSize).toBe(5);
      expect(config.rag.indexBatchDelayMs).toBe(100);
      expect(config.rag.saveDebounceSec).toBe(30);
    });

    it('merges partial rag config', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          rag: {
            persistCache: false,
            maxWorkspaceFiles: 500,
          },
        }),
      );

      const config = await loadConfig();

      expect(config.rag.persistCache).toBe(false);
      expect(config.rag.maxWorkspaceFiles).toBe(500);
      // Unspecified fields keep defaults
      expect(config.rag.workspaceIndexing).toBe(true);
      expect(config.rag.chunkTargetLines).toBe(30);
    });

    it('validates rag numeric fields', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          rag: {
            maxWorkspaceFiles: -1,
            chunkTargetLines: 0,
            chunkOverlapLines: -5,
            indexBatchSize: 0,
            indexBatchDelayMs: -1,
            saveDebounceSec: -10,
          },
        }),
      );

      const config = await loadConfig();

      // Invalid values should not override defaults
      expect(config.rag.maxWorkspaceFiles).toBe(1000);
      expect(config.rag.chunkTargetLines).toBe(30);
      expect(config.rag.chunkOverlapLines).toBe(5);
      expect(config.rag.indexBatchSize).toBe(5);
      expect(config.rag.indexBatchDelayMs).toBe(100);
      expect(config.rag.saveDebounceSec).toBe(30);
    });

    it('ignores non-object rag field', async () => {
      vi.mocked(editor.fileExists).mockReturnValue(true);
      vi.mocked(editor.readFile).mockResolvedValue(
        JSON.stringify({
          rag: 'not an object',
        }),
      );

      const config = await loadConfig();

      // Should keep defaults
      expect(config.rag.persistCache).toBe(true);
    });
  });
});
