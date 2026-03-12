import { embed, embedBatch } from './embedding';
import { splitIntoChunks } from './chunking';
import type { PersistedStore } from './persistence';
import {
  loadStore as loadPersistedStore,
  writeStoreFile,
  shouldInvalidateCache,
  computeConfigHash,
} from './persistence';

export interface CodeChunk {
  filePath: string;
  content: string;
  embedding: number[];
  startLine: number;
  endLine: number;
  scopeName?: string | undefined;
}

const MAX_CHUNKS = 500;

const store = new Map<string, CodeChunk[]>();
const accessOrder: string[] = [];
let expectedDimension: number | null = null;
const indexGeneration = new Map<string, number>();
const contentHashes = new Map<string, string>();

let persistMeta: { model: string; provider: string; endpoint?: string } | null = null;
let saveDebounceSec = 30;
let saveGeneration = 0;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

function totalChunkCount(): number {
  let count = 0;
  for (const chunks of store.values()) {
    count += chunks.length;
  }
  return count;
}

function touchAccessOrder(filePath: string): void {
  const idx = accessOrder.indexOf(filePath);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(filePath);
}

function evictUntilRoom(needed: number): void {
  while (totalChunkCount() + needed > MAX_CHUNKS && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    if (oldest !== undefined) store.delete(oldest);
  }
}

function serializeStore(): PersistedStore {
  let dimension = expectedDimension ?? 0;
  if (dimension === 0) {
    for (const chunks of store.values()) {
      const first = chunks[0];
      if (first !== undefined && first.embedding.length > 0) {
        dimension = first.embedding.length;
        break;
      }
    }
  }

  return {
    version: 1,
    embeddingModel: persistMeta?.model ?? '',
    embeddingProvider: persistMeta?.provider ?? '',
    embeddingDimension: dimension,
    configHash: persistMeta !== null ? computeConfigHash(persistMeta) : undefined,
    timestamp: Date.now(),
    files: Array.from(store.entries()).map(([filePath, chunks]) => ({
      filePath,
      contentHash: contentHashes.get(filePath) ?? '',
      chunks: chunks.map((c) => ({
        content: c.content,
        embedding: c.embedding,
        startLine: c.startLine,
        endLine: c.endLine,
        scopeName: c.scopeName,
      })),
    })),
  };
}

export function scheduleSave(): void {
  if (persistMeta === null) return;
  const gen = ++saveGeneration;
  void (async (): Promise<void> => {
    await editor.delay(saveDebounceSec * 1000);
    if (saveGeneration !== gen) return;
    try {
      await writeStoreFile(serializeStore());
    } catch {
      // Save failure is non-fatal
    }
  })();
}

async function indexText(filePath: string, text: string): Promise<void> {
  if (text.trim() === '') {
    store.delete(filePath);
    const idx = accessOrder.indexOf(filePath);
    if (idx !== -1) accessOrder.splice(idx, 1);
    return;
  }

  // Remove existing chunks for this file before re-indexing
  store.delete(filePath);

  const rawChunks = splitIntoChunks(text);
  const contents = rawChunks.map((c) => c.content);

  const gen = (indexGeneration.get(filePath) ?? 0) + 1;
  indexGeneration.set(filePath, gen);

  const embeddings = await embedBatch(contents);

  // Superseded by a newer call — discard results
  if (indexGeneration.get(filePath) !== gen) return;

  const indexed: CodeChunk[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const emb = embeddings[i];
    if (emb === null || emb === undefined) continue;

    expectedDimension ??= emb.length;

    const chunk = rawChunks[i];
    if (chunk === undefined) continue;
    const entry: CodeChunk = {
      filePath,
      content: chunk.content,
      embedding: emb,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    };
    if (chunk.scopeName !== undefined) {
      entry.scopeName = chunk.scopeName;
    }
    indexed.push(entry);
  }

  // Cap to MAX_CHUNKS so a single oversized file can't bust the limit
  const capped = indexed.slice(0, MAX_CHUNKS);

  if (capped.length > 0) {
    evictUntilRoom(capped.length);
    store.set(filePath, capped);
    touchAccessOrder(filePath);
    scheduleSave();
  }
}

export async function indexBuffer(bufferId: number): Promise<void> {
  const filePath = editor.getBufferPath(bufferId);
  const length = editor.getBufferLength(bufferId);
  const text = await editor.getBufferText(bufferId, 0, length);
  await indexText(filePath, text);
}

export async function indexFileContent(filePath: string, text: string): Promise<void> {
  await indexText(filePath, text);
}

export async function findRelevant(query: string, topK: number): Promise<CodeChunk[]> {
  const queryEmbedding = await embed(query);
  if (queryEmbedding === null) return [];

  if (expectedDimension !== null && queryEmbedding.length !== expectedDimension) {
    editor.setStatus('AI: embedding dimension mismatch — clear and re-index buffers');
    return [];
  }

  // Top-K selection without full sort
  const topResults: { chunk: CodeChunk; score: number }[] = [];
  let minScore = -Infinity;

  for (const chunks of store.values()) {
    for (const chunk of chunks) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (topResults.length < topK) {
        topResults.push({ chunk, score });
        if (topResults.length === topK) {
          topResults.sort((a, b) => a.score - b.score);
          const first = topResults[0];
          if (first !== undefined) minScore = first.score;
        }
      } else if (score > minScore) {
        topResults[0] = { chunk, score };
        topResults.sort((a, b) => a.score - b.score);
        minScore = topResults[0].score;
      }
    }
  }

  // Touch access order only for files in final top-K results
  const touchedFiles = new Set(topResults.map((r) => r.chunk.filePath));
  for (const fp of touchedFiles) {
    touchAccessOrder(fp);
  }

  // Sort final results descending
  topResults.sort((a, b) => b.score - a.score);
  return topResults.map((s) => s.chunk);
}

export function invalidateBuffer(filePath: string): void {
  store.delete(filePath);
  indexGeneration.delete(filePath);
  const idx = accessOrder.indexOf(filePath);
  if (idx !== -1) accessOrder.splice(idx, 1);
}

export function getStoreSize(): number {
  return store.size;
}

export function getContentHash(filePath: string): string | undefined {
  return contentHashes.get(filePath);
}

export function setContentHash(filePath: string, hash: string): void {
  contentHashes.set(filePath, hash);
}

export function clearStore(): void {
  store.clear();
  accessOrder.length = 0;
  expectedDimension = null;
  indexGeneration.clear();
  contentHashes.clear();
  saveGeneration++;
}

export async function initStore(
  model: string,
  provider: string,
  debounceSec?: number,
  endpoint?: string,
): Promise<void> {
  persistMeta = endpoint !== undefined ? { model, provider, endpoint } : { model, provider };
  if (debounceSec !== undefined) saveDebounceSec = debounceSec;

  const persisted = await loadPersistedStore();
  if (persisted === null) return;
  const current = endpoint !== undefined ? { model, provider, endpoint } : { model, provider };
  if (shouldInvalidateCache(persisted, current)) return;

  // Hydrate in-memory store from persisted data
  for (const file of persisted.files) {
    const chunks: CodeChunk[] = [];
    for (const c of file.chunks) {
      const entry: CodeChunk = {
        filePath: file.filePath,
        content: c.content,
        embedding: c.embedding,
        startLine: c.startLine,
        endLine: c.endLine,
      };
      if (c.scopeName !== undefined) {
        entry.scopeName = c.scopeName;
      }
      chunks.push(entry);
    }

    if (chunks.length > 0) {
      store.set(file.filePath, chunks);
      accessOrder.push(file.filePath);
      const first = chunks[0];
      if (expectedDimension === null && first !== undefined && first.embedding.length > 0) {
        expectedDimension = first.embedding.length;
      }
    }
    if (file.contentHash !== '') {
      contentHashes.set(file.filePath, file.contentHash);
    }
  }
}
