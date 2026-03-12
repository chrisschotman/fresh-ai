import { shellEscape, spawnCancellable } from '../bridge';
import { hashContent } from './persistence';
import { indexFileContent, getContentHash, setContentHash } from './rag';
import { recordIndexing } from './metrics';
import type { RagConfig } from '../config';

let cachedProjectRoot: string | null | undefined;

export async function getProjectRoot(): Promise<string | null> {
  if (cachedProjectRoot !== undefined) return cachedProjectRoot;
  try {
    const handle = await spawnCancellable('git rev-parse --show-toplevel');
    const result = await handle.wait();
    cachedProjectRoot = result.exitCode === 0 ? result.stdout.trim() : null;
  } catch {
    cachedProjectRoot = null;
  }
  return cachedProjectRoot;
}

export async function discoverFiles(
  cwd: string,
  disabledExtensions: string[],
  maxFiles: number,
): Promise<string[]> {
  let files: string[] = [];

  try {
    const handle = await spawnCancellable(
      `cd ${shellEscape(cwd)} && git ls-files`,
    );
    const result = await handle.wait();
    if (result.exitCode === 0) {
      files = result.stdout.trim().split('\n').filter(Boolean);
    }
  } catch {
    // fallback below
  }

  if (files.length === 0) {
    try {
      const handle = await spawnCancellable(
        `find ${shellEscape(cwd)} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -n ${String(maxFiles)}`,
      );
      const result = await handle.wait();
      if (result.exitCode === 0) {
        files = result.stdout.trim().split('\n').filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  // Make paths absolute
  files = files.map((f) => (f.startsWith('/') ? f : editor.pathJoin([cwd, f])));

  // Filter by disabled extensions
  const extSet = new Set(disabledExtensions);
  files = files.filter((f) => !extSet.has(editor.pathExtname(f)));

  return files.slice(0, maxFiles);
}

export async function indexFile(filePath: string): Promise<boolean> {
  try {
    const text = await editor.readFile(filePath);
    if (text.trim() === '') return false;

    const hash = hashContent(text);
    const existing = getContentHash(filePath);
    if (existing === hash) return false;

    await indexFileContent(filePath, text);
    setContentHash(filePath, hash);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    editor.setStatus(`AI: indexing failed for ${filePath} — ${msg}`);
    return false;
  }
}

export async function indexWorkspace(config: RagConfig, disabledExtensions: string[]): Promise<void> {
  const root = await getProjectRoot();
  if (root === null) return;

  editor.setStatus('AI: discovering workspace files...');
  const files = await discoverFiles(root, disabledExtensions, config.maxWorkspaceFiles);

  if (files.length === 0) return;

  editor.setStatus(`AI: indexing ${String(files.length)} files...`);

  const indexStart = Date.now();
  let indexed = 0;
  for (let i = 0; i < files.length; i += config.indexBatchSize) {
    const batch = files.slice(i, i + config.indexBatchSize);
    const results = await Promise.all(batch.map((f) => indexFile(f)));
    indexed += results.filter(Boolean).length;

    if (i + config.indexBatchSize < files.length) {
      await editor.delay(config.indexBatchDelayMs);
    }
  }

  recordIndexing(Date.now() - indexStart, indexed);
  editor.setStatus(`AI: indexed ${String(indexed)} files`);
}

export function resetProjectRoot(): void {
  cachedProjectRoot = undefined;
}
