export interface SessionMetrics {
  completionRequests: number;
  completionSuccesses: number;
  completionFailures: number;
  totalCompletionMs: number;
  ragSearches: number;
  totalRagSearchMs: number;
  embeddingRequests: number;
  totalEmbeddingMs: number;
  filesIndexed: number;
  totalIndexingMs: number;
}

const metrics: SessionMetrics = {
  completionRequests: 0,
  completionSuccesses: 0,
  completionFailures: 0,
  totalCompletionMs: 0,
  ragSearches: 0,
  totalRagSearchMs: 0,
  embeddingRequests: 0,
  totalEmbeddingMs: 0,
  filesIndexed: 0,
  totalIndexingMs: 0,
};

let verbosity: 'off' | 'minimal' | 'verbose' = 'off';

export function setVerbosity(level: 'off' | 'minimal' | 'verbose'): void {
  verbosity = level;
}

export function getVerbosity(): 'off' | 'minimal' | 'verbose' {
  return verbosity;
}

function log(message: string, level: 'minimal' | 'verbose' = 'minimal'): void {
  if (verbosity === 'off') return;
  if (verbosity === 'minimal' && level === 'verbose') return;
  editor.setStatus(message);
}

export function recordCompletion(durationMs: number, success: boolean): void {
  metrics.completionRequests++;
  metrics.totalCompletionMs += durationMs;
  if (success) {
    metrics.completionSuccesses++;
  } else {
    metrics.completionFailures++;
  }
  log(`AI: completion ${durationMs.toString()}ms (${success ? 'ok' : 'fail'})`, 'verbose');
}

export function recordRagSearch(durationMs: number): void {
  metrics.ragSearches++;
  metrics.totalRagSearchMs += durationMs;
  log(`AI: RAG search ${durationMs.toString()}ms`, 'verbose');
}

export function recordEmbedding(durationMs: number): void {
  metrics.embeddingRequests++;
  metrics.totalEmbeddingMs += durationMs;
  log(`AI: embedding ${durationMs.toString()}ms`, 'verbose');
}

export function recordIndexing(durationMs: number, fileCount: number): void {
  metrics.filesIndexed += fileCount;
  metrics.totalIndexingMs += durationMs;
  log(`AI: indexed ${fileCount.toString()} files in ${durationMs.toString()}ms`, 'verbose');
}

export function getMetrics(): SessionMetrics {
  return { ...metrics };
}

export function formatStats(): string {
  const avgCompletion =
    metrics.completionRequests > 0
      ? Math.round(metrics.totalCompletionMs / metrics.completionRequests)
      : 0;
  const avgRag =
    metrics.ragSearches > 0
      ? Math.round(metrics.totalRagSearchMs / metrics.ragSearches)
      : 0;

  return [
    `Completions: ${metrics.completionRequests.toString()} (${metrics.completionSuccesses.toString()} ok, ${metrics.completionFailures.toString()} fail, avg ${avgCompletion.toString()}ms)`,
    `RAG searches: ${metrics.ragSearches.toString()} (avg ${avgRag.toString()}ms)`,
    `Embeddings: ${metrics.embeddingRequests.toString()} (${metrics.totalEmbeddingMs.toString()}ms total)`,
    `Files indexed: ${metrics.filesIndexed.toString()} (${metrics.totalIndexingMs.toString()}ms total)`,
  ].join(' | ');
}

export function resetMetrics(): void {
  metrics.completionRequests = 0;
  metrics.completionSuccesses = 0;
  metrics.completionFailures = 0;
  metrics.totalCompletionMs = 0;
  metrics.ragSearches = 0;
  metrics.totalRagSearchMs = 0;
  metrics.embeddingRequests = 0;
  metrics.totalEmbeddingMs = 0;
  metrics.filesIndexed = 0;
  metrics.totalIndexingMs = 0;
}
