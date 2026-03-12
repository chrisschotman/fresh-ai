export interface BufferContext {
  prefix: string;
  suffix: string;
  language: string;
  filePath: string;
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.cs': 'csharp',
  '.lua': 'lua',
  '.sh': 'bash',
  '.zsh': 'bash',
  '.bash': 'bash',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.zig': 'zig',
  '.odin': 'odin',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

function detectLanguage(filePath: string): string {
  const ext = editor.pathExtname(filePath);
  return EXT_TO_LANGUAGE[ext] ?? (ext.replace('.', '') || 'text');
}

function clampByteOffset(offset: number, length: number): number {
  return Math.max(0, Math.min(offset, length));
}

export async function gatherContext(
  bufferId: number,
  cursorOffset: number,
  maxContextLines: number,
): Promise<BufferContext> {
  const filePath = editor.getBufferPath(bufferId);
  const bufferLength = editor.getBufferLength(bufferId);
  const language = detectLanguage(filePath);

  const safeOffset = clampByteOffset(cursorOffset, bufferLength);

  // Get prefix: text before cursor
  // Estimate byte range for maxContextLines (~80 chars per line)
  const prefixStart = Math.max(0, safeOffset - maxContextLines * 80);
  const prefix = await editor.getBufferText(bufferId, prefixStart, safeOffset);

  // Get suffix: text after cursor
  const suffixEnd = Math.min(bufferLength, safeOffset + maxContextLines * 80);
  const suffix = await editor.getBufferText(bufferId, safeOffset, suffixEnd);

  return { prefix, suffix, language, filePath };
}
