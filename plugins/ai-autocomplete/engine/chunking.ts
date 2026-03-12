export interface ChunkMeta {
  content: string;
  startLine: number;
  endLine: number;
  scopeName?: string | undefined;
}

export interface ChunkOptions {
  targetLines: number;
  overlapLines: number;
  respectBoundaries: boolean;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  targetLines: 30,
  overlapLines: 5,
  respectBoundaries: true,
};

const BOUNDARY_PATTERNS = [
  /^(?:export\s+)?(?:async\s+)?function\s+\w+/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
  /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/,
  /^(?:export\s+)?interface\s+\w+/,
  /^(?:export\s+)?type\s+\w+/,
  /^(?:export\s+)?enum\s+\w+/,
  /^def\s+\w+/,
  /^class\s+\w+/,
  /^(?:pub\s+)?(?:async\s+)?fn\s+\w+/,
  /^impl\s+/,
  /^func\s+\w+/,
  /^(?:pub\s+)?(?:struct|enum|trait|mod)\s+\w+/,
];

const SCOPE_NAME_RE =
  /(?:function|class|def|fn|func|impl|interface|type|enum|struct|trait|mod)\s+(\w+)/;

export function findBoundaries(lines: string[]): number[] {
  const boundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trimStart();
    for (const pattern of BOUNDARY_PATTERNS) {
      if (pattern.test(trimmed)) {
        boundaries.push(i);
        break;
      }
    }
  }
  return boundaries;
}

export function detectScopeName(lines: string[], boundaryLine: number): string | undefined {
  const line = lines[boundaryLine];
  if (line === undefined) return undefined;
  const match = SCOPE_NAME_RE.exec(line.trimStart());
  return match?.[1];
}

export function splitIntoChunks(
  text: string,
  options?: Partial<ChunkOptions>,
): ChunkMeta[] {
  const opts: ChunkOptions = { ...DEFAULT_OPTIONS, ...options };
  const lines = text.split('\n');
  if (lines.length === 0) return [];

  const boundarySet = new Set<number>();
  if (opts.respectBoundaries) {
    for (const b of findBoundaries(lines)) {
      boundarySet.add(b);
    }
  }

  const chunks: ChunkMeta[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = Math.min(start + opts.targetLines, lines.length);

    // Snap to a nearby boundary if within 5 lines of the target end
    if (opts.respectBoundaries && end < lines.length) {
      let bestBoundary = -1;
      for (let probe = end - 5; probe <= end + 5 && probe < lines.length; probe++) {
        if (probe > start && boundarySet.has(probe)) {
          bestBoundary = probe;
          break;
        }
      }
      if (bestBoundary > 0) {
        end = bestBoundary;
      }
    }

    const slice = lines.slice(start, end);
    const content = slice.join('\n').trim();

    if (content !== '') {
      let scopeName: string | undefined;
      for (let i = start; i < end; i++) {
        if (boundarySet.has(i)) {
          scopeName = detectScopeName(lines, i);
          if (scopeName !== undefined) break;
        }
      }

      chunks.push({
        content,
        startLine: start + 1,
        endLine: end,
        scopeName,
      });
    }

    if (end >= lines.length) break;

    // Overlap: next chunk starts overlapLines before end, but always advances
    const prevStart = start;
    start = Math.max(end - opts.overlapLines, prevStart + 1);
  }

  return chunks;
}
