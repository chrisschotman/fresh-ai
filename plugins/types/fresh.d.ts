/** Fresh editor global API */
interface FreshEditor {
  // Buffer management
  getActiveBufferId(): number | null;
  getBufferPath(bufferId: number): string;
  getBufferLength(bufferId: number): number;
  getBufferText(bufferId: number, start: number, end: number): Promise<string>;

  // Cursor
  getCursorPosition(): number;
  insertAtCursor(text: string): void;

  // Virtual text (ghost text)
  addVirtualText(
    bufferId: number,
    namespace: string,
    position: number,
    text: string,
    r: number,
    g: number,
    b: number,
    bold: boolean,
    italic: boolean,
  ): void;
  removeVirtualTextsByPrefix(bufferId: number, prefix: string): void;
  refreshLines(bufferId: number): void;

  // Events & commands
  on(event: string, handler: string): void;
  registerCommand(id: string, label: string, handler: string, mode?: string): void;

  // Status
  setStatus(message: string): void;

  // File system
  fileExists(path: string): boolean;
  readFile(path: string): Promise<string>;
  getConfigDir(): string;
  pathJoin(parts: string[]): string;
  pathExtname(path: string): string;

  // Environment
  getEnv(name: string): string;

  // Process management
  spawnBackgroundProcess(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<{ process_id: number }>;
  spawnProcessWait(processId: number): Promise<{
    stdout: string;
    stderr: string;
    exit_code: number;
  }>;
  killProcess(processId: number): Promise<boolean>;

  // Timing
  delay(ms: number): Promise<void>;
}

// eslint-disable-next-line no-var
declare var editor: FreshEditor;

// eslint-disable-next-line no-var
declare var ai_autocomplete_buffer_modified: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_cursor_moved: (() => void) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_accept: (() => void) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_dismiss: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_toggle: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_trigger: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_reload_config: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_autocomplete_buffer_saved: (() => Promise<void>) | undefined;
// eslint-disable-next-line no-var
declare var ai_reindex_workspace: (() => Promise<void>) | undefined;
