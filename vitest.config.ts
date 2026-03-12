import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['plugins/**/__tests__/**/*.test.ts'],
    setupFiles: ['plugins/ai-autocomplete/__tests__/setup.ts'],
    restoreMocks: true,
  },
});
