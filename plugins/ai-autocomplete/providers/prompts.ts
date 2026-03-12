import type { CompletionRequest } from './types';

const BASE_SYSTEM_PROMPT = `You are a code completion assistant. Complete the code at the <CURSOR> position. Output ONLY the completion text — no explanations, no markdown, no code fences. If you cannot complete, output nothing.`;

const LANGUAGE_HINTS: Record<string, string> = {
  typescript: 'Use TypeScript types and interfaces. Prefer const/let over var. Use async/await over raw promises.',
  javascript: 'Use modern ES6+ syntax. Prefer const/let over var. Use async/await over raw promises.',
  python: 'Follow PEP 8. Use type hints. Prefer f-strings over format().',
  rust: 'Use idiomatic Rust. Prefer Result/Option over panics. Follow ownership rules.',
  go: 'Follow Go conventions. Use error returns, not exceptions. Use short variable names.',
  java: 'Follow Java conventions. Use proper access modifiers. Prefer streams for collections.',
  c: 'Follow C99+ conventions. Check return values. Free allocated memory.',
  cpp: 'Use modern C++ (C++17+). Prefer smart pointers. Use RAII.',
  ruby: 'Follow Ruby conventions. Use blocks and iterators. Prefer symbols over strings for keys.',
  php: 'Follow PSR-12. Use type declarations. Use null coalescing operators.',
  swift: 'Use Swift conventions. Prefer guard/let for optionals. Use value types when appropriate.',
  kotlin: 'Use Kotlin idioms. Prefer val over var. Use null safety features.',
  csharp: 'Follow C# conventions. Use async/await. Prefer LINQ for queries.',
  lua: 'Follow Lua conventions. Use local variables. Tables are the primary data structure.',
  shell: 'Use POSIX-compatible syntax. Quote variables. Check command exit codes.',
  html: 'Use semantic HTML5 elements. Include proper accessibility attributes.',
  css: 'Use modern CSS. Prefer custom properties. Use logical properties when appropriate.',
  sql: 'Use parameterized queries. Prefer explicit JOINs over implicit. Use aliases for readability.',
  zig: 'Use idiomatic Zig. Handle errors explicitly. Prefer comptime when possible.',
  odin: 'Follow Odin conventions. Use explicit memory management. Prefer multiple return values.',
};

export function getSystemPrompt(language: string): string {
  const hint = LANGUAGE_HINTS[language];
  if (hint === undefined) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n${hint}`;
}

export { BASE_SYSTEM_PROMPT as SYSTEM_PROMPT };

export function buildFimPrompt(request: CompletionRequest): string {
  let prompt = `Complete the following ${request.language} code at <CURSOR>. Output ONLY the missing code.\n\n`;

  if (request.ragContext !== undefined && request.ragContext !== '') {
    prompt += `Here is relevant code from the project for context:\n---\n${request.ragContext}\n---\n\n`;
  }

  prompt += `${request.prefix}<CURSOR>${request.suffix}`;
  return prompt;
}

export function getLanguageHint(language: string): string | undefined {
  return LANGUAGE_HINTS[language];
}
