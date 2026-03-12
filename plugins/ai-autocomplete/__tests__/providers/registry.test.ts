import { getProviderByName, resolveProviderConfig } from '../../providers/registry';

describe('registry', () => {
  describe('getProviderByName', () => {
    it('returns anthropic provider', () => {
      const provider = getProviderByName('anthropic');
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('anthropic');
    });

    it('returns openai-compatible provider', () => {
      const provider = getProviderByName('openai-compatible');
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('openai-compatible');
    });

    it('returns ollama provider', () => {
      const provider = getProviderByName('ollama');
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('ollama');
    });

    it('returns null for unknown provider', () => {
      expect(getProviderByName('unknown')).toBeNull();
      expect(getProviderByName('')).toBeNull();
    });
  });

  describe('getProvider', () => {
    it('returns provider for current autocomplete model', async () => {
      vi.resetModules();
      vi.mocked(editor.fileExists).mockReturnValue(false);
      vi.mocked(editor.getEnv).mockReturnValue('');

      const configMod = await import('../../config');
      await configMod.loadConfig();

      const { getProvider } = await import('../../providers/registry');
      const provider = getProvider();

      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('openai-compatible');
    });
  });

  describe('resolveProviderConfig', () => {
    const defaults = {
      defaultEndpoint: 'https://api.example.com',
      defaultModel: 'default-model',
    };

    it('resolves config with custom endpoint and model', () => {
      const result = resolveProviderConfig(
        { endpoint: 'https://custom.api', model: 'custom-model', apiKeyEnv: 'MY_KEY' },
        defaults,
      );

      expect(result).toEqual({
        endpoint: 'https://custom.api',
        model: 'custom-model',
        apiKeyEnv: 'MY_KEY',
      });
    });

    it('falls back to defaults for empty endpoint and model', () => {
      const result = resolveProviderConfig(
        { endpoint: '', model: '', apiKeyEnv: 'MY_KEY' },
        defaults,
      );

      expect(result).toEqual({
        endpoint: 'https://api.example.com',
        model: 'default-model',
        apiKeyEnv: 'MY_KEY',
      });
    });

    it('returns null for invalid apiKeyEnv with spaces', () => {
      const result = resolveProviderConfig(
        { endpoint: '', model: '', apiKeyEnv: 'MY KEY' },
        defaults,
      );

      expect(result).toBeNull();
    });

    it('returns null for apiKeyEnv with shell metacharacters', () => {
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: 'KEY;rm -rf /' }, defaults),
      ).toBeNull();
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: '$(whoami)' }, defaults),
      ).toBeNull();
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: 'KEY"VALUE' }, defaults),
      ).toBeNull();
    });

    it('returns null for empty apiKeyEnv', () => {
      const result = resolveProviderConfig(
        { endpoint: '', model: '', apiKeyEnv: '' },
        defaults,
      );

      expect(result).toBeNull();
    });

    it('accepts valid apiKeyEnv patterns', () => {
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: 'OPENAI_API_KEY' }, defaults),
      ).not.toBeNull();
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: '_KEY' }, defaults),
      ).not.toBeNull();
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: 'key123' }, defaults),
      ).not.toBeNull();
      expect(
        resolveProviderConfig({ endpoint: '', model: '', apiKeyEnv: 'NONE' }, defaults),
      ).not.toBeNull();
    });

    it('returns null for apiKeyEnv starting with a digit', () => {
      const result = resolveProviderConfig(
        { endpoint: '', model: '', apiKeyEnv: '1KEY' },
        defaults,
      );

      expect(result).toBeNull();
    });
  });
});
