export {};

beforeEach(() => {
  globalThis.editor = {
    getActiveBufferId: vi.fn(() => 1),
    getBufferPath: vi.fn(() => '/project/src/main.ts'),
    getBufferLength: vi.fn(() => 1000),
    getBufferText: vi.fn(async () => ''),
    getCursorPosition: vi.fn(() => 100),
    insertAtCursor: vi.fn(),
    addVirtualText: vi.fn(),
    removeVirtualTextsByPrefix: vi.fn(),
    refreshLines: vi.fn(),
    setStatus: vi.fn(),
    on: vi.fn(),
    registerCommand: vi.fn(),
    getConfigDir: vi.fn(() => '/home/user/.config/fresh'),
    pathJoin: vi.fn((parts: string[]) => parts.join('/')),
    pathExtname: vi.fn((path: string) => {
      const dot = path.lastIndexOf('.');
      return dot === -1 ? '' : path.slice(dot);
    }),
    fileExists: vi.fn(() => false),
    readFile: vi.fn(async () => '{}'),
    getEnv: vi.fn(() => ''),
    delay: vi.fn(async () => undefined),
    spawnBackgroundProcess: vi.fn(async () => ({ process_id: 42 })),
    spawnProcessWait: vi.fn(async () => ({
      stdout: '',
      stderr: '',
      exit_code: 0,
    })),
    killProcess: vi.fn(async () => true),
  };
});
