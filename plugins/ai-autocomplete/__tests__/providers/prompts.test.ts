import { SYSTEM_PROMPT, getSystemPrompt, buildFimPrompt, getLanguageHint } from '../../providers/prompts';
import type { CompletionRequest } from '../../providers/types';

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains key instructions', () => {
    expect(SYSTEM_PROMPT).toContain('code completion');
    expect(SYSTEM_PROMPT).toContain('ONLY');
  });
});

describe('getSystemPrompt', () => {
  it('returns base prompt for unknown language', () => {
    const prompt = getSystemPrompt('brainfuck');
    expect(prompt).toBe(SYSTEM_PROMPT);
  });

  it('appends language hint for typescript', () => {
    const prompt = getSystemPrompt('typescript');
    expect(prompt).toContain(SYSTEM_PROMPT);
    expect(prompt).toContain('TypeScript');
    expect(prompt.length).toBeGreaterThan(SYSTEM_PROMPT.length);
  });

  it('appends language hint for python', () => {
    const prompt = getSystemPrompt('python');
    expect(prompt).toContain('PEP 8');
  });

  it('appends language hint for rust', () => {
    const prompt = getSystemPrompt('rust');
    expect(prompt).toContain('Result/Option');
  });

  it('appends language hint for go', () => {
    const prompt = getSystemPrompt('go');
    expect(prompt).toContain('Go conventions');
  });

  it('returns different prompts for different languages', () => {
    const ts = getSystemPrompt('typescript');
    const py = getSystemPrompt('python');
    expect(ts).not.toBe(py);
  });
});

describe('getLanguageHint', () => {
  it('returns hint for known language', () => {
    expect(getLanguageHint('typescript')).toBeDefined();
    expect(getLanguageHint('python')).toBeDefined();
  });

  it('returns undefined for unknown language', () => {
    expect(getLanguageHint('brainfuck')).toBeUndefined();
  });
});

describe('buildFimPrompt', () => {
  const request: CompletionRequest = {
    prefix: 'function hello() {',
    suffix: '\n}',
    language: 'typescript',
    filePath: '/project/hello.ts',
    maxTokens: 128,
    temperature: 0,
  };

  it('includes language', () => {
    const prompt = buildFimPrompt(request);
    expect(prompt).toContain('typescript');
  });

  it('includes prefix', () => {
    const prompt = buildFimPrompt(request);
    expect(prompt).toContain('function hello() {');
  });

  it('includes <CURSOR> marker', () => {
    const prompt = buildFimPrompt(request);
    expect(prompt).toContain('<CURSOR>');
  });

  it('includes suffix', () => {
    const prompt = buildFimPrompt(request);
    expect(prompt).toContain('\n}');
  });

  it('has prefix before cursor and suffix after', () => {
    const prompt = buildFimPrompt(request);
    const cursorIdx = prompt.indexOf('<CURSOR>');
    const prefixIdx = prompt.indexOf('function hello() {');
    const suffixIdx = prompt.lastIndexOf('\n}');

    expect(cursorIdx).toBeGreaterThan(-1);
    expect(prefixIdx).toBeGreaterThan(-1);
    expect(suffixIdx).toBeGreaterThan(cursorIdx);
  });

  it('includes RAG context when provided', () => {
    const reqWithRag: CompletionRequest = {
      ...request,
      ragContext: '// /project/utils.ts:1-10\nfunction add(a: number, b: number) { return a + b; }',
    };
    const prompt = buildFimPrompt(reqWithRag);

    expect(prompt).toContain('relevant code from the project');
    expect(prompt).toContain('function add(a: number, b: number)');
  });

  it('does not include RAG section when ragContext is empty', () => {
    const reqNoRag: CompletionRequest = {
      ...request,
      ragContext: '',
    };
    const prompt = buildFimPrompt(reqNoRag);

    expect(prompt).not.toContain('relevant code from the project');
  });

  it('does not include RAG section when ragContext is undefined', () => {
    const prompt = buildFimPrompt(request);

    expect(prompt).not.toContain('relevant code from the project');
  });
});
