import { writeFile } from '../bridge';

export interface PersistedChunk {
  content: string;
  embedding: number[];
  startLine: number;
  endLine: number;
  scopeName?: string | undefined;
}

export interface PersistedFile {
  filePath: string;
  contentHash: string;
  chunks: PersistedChunk[];
}

export interface PersistedStore {
  version: 1;
  embeddingModel: string;
  embeddingProvider: string;
  embeddingDimension: number;
  configHash?: string | undefined;
  timestamp: number;
  files: PersistedFile[];
}

export function hashContent(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getStorePath(): string {
  return editor.pathJoin([editor.getConfigDir(), 'rag-cache.json']);
}

export function deserialize(json: string): PersistedStore | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj['version'] !== 1) return null;
    if (typeof obj['embeddingModel'] !== 'string') return null;
    if (typeof obj['embeddingProvider'] !== 'string') return null;
    if (typeof obj['embeddingDimension'] !== 'number') return null;
    if (!Array.isArray(obj['files'])) return null;
    return parsed as PersistedStore;
  } catch {
    return null;
  }
}

export function computeConfigHash(config: { model: string; provider: string; endpoint?: string }): string {
  const key = `${config.provider}:${config.model}:${config.endpoint ?? ''}`;
  return hashContent(key);
}

export function shouldInvalidateCache(
  cached: PersistedStore,
  current: { model: string; provider: string; endpoint?: string },
): boolean {
  // Check config hash first (preferred)
  if (cached.configHash !== undefined) {
    return cached.configHash !== computeConfigHash(current);
  }
  // Fallback to legacy field comparison
  return cached.embeddingModel !== current.model || cached.embeddingProvider !== current.provider;
}

export async function loadStore(): Promise<PersistedStore | null> {
  const path = getStorePath();
  if (!editor.fileExists(path)) return null;
  try {
    const json = await editor.readFile(path);
    return deserialize(json);
  } catch {
    return null;
  }
}

export async function writeStoreFile(data: PersistedStore): Promise<void> {
  const path = getStorePath();
  const json = JSON.stringify(data);
  await writeFile(path, json);
}
