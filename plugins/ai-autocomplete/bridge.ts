export interface HttpResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  processId: number;
}

/**
 * Escape a string for use inside single quotes in a shell command.
 * Replaces ' with '\'' (end quote, escaped quote, start quote).
 */
export function shellEscape(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

export async function writeFile(path: string, content: string): Promise<boolean> {
  const tmpPath = path + '.tmp';
  const CHUNK_SIZE = 100 * 1024;

  if (content.length <= CHUNK_SIZE) {
    const cmd = `printf '%s' ${shellEscape(content)} > ${shellEscape(tmpPath)} && mv ${shellEscape(tmpPath)} ${shellEscape(path)}`;
    const handle = await spawnCancellable(cmd);
    const result = await handle.wait();
    return result.exitCode === 0;
  }

  // Large payload: split into appends to avoid argument length limits
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    const chunk = content.slice(i, i + CHUNK_SIZE);
    const op = i === 0 ? '>' : '>>';
    const cmd = `printf '%s' ${shellEscape(chunk)} ${op} ${shellEscape(tmpPath)}`;
    const handle = await spawnCancellable(cmd);
    const result = await handle.wait();
    if (result.exitCode !== 0) return false;
  }

  const mvHandle = await spawnCancellable(
    `mv ${shellEscape(tmpPath)} ${shellEscape(path)}`,
  );
  const mvResult = await mvHandle.wait();
  return mvResult.exitCode === 0;
}

const KILL_TIMEOUT_MS = 2000;

const activeProcesses = new Set<number>();

export async function spawnCancellable(shellCommand: string): Promise<{
  processId: number;
  wait: () => Promise<HttpResult>;
  cancel: () => Promise<boolean>;
}> {
  const { process_id } = await editor.spawnBackgroundProcess('sh', ['-c', shellCommand], '.');
  activeProcesses.add(process_id);

  return {
    processId: process_id,
    wait: async (): Promise<HttpResult> => {
      const result = await editor.spawnProcessWait(process_id);
      activeProcesses.delete(process_id);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exit_code,
        processId: process_id,
      };
    },
    cancel: async (): Promise<boolean> => {
      const killed = await editor.killProcess(process_id);
      if (!killed) {
        // SIGTERM didn't work — wait then force kill
        await editor.delay(KILL_TIMEOUT_MS);
        try {
          await editor.killProcess(process_id);
        } catch {
          // Process may have exited during the wait
        }
      }
      activeProcesses.delete(process_id);
      return killed;
    },
  };
}

export async function cleanupAllProcesses(): Promise<void> {
  const pids = Array.from(activeProcesses);
  activeProcesses.clear();
  await Promise.all(
    pids.map(async (pid) => {
      try {
        await editor.killProcess(pid);
      } catch {
        // Process may have already exited
      }
    }),
  );
}
