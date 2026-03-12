import { splitIntoChunks, findBoundaries, detectScopeName } from '../../engine/chunking';

describe('findBoundaries', () => {
  it('detects JS/TS function declarations', () => {
    const lines = ['const x = 1;', 'function foo() {', '  return 1;', '}'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('detects exported async functions', () => {
    const lines = ['export async function bar() {', '  return 1;', '}'];
    expect(findBoundaries(lines)).toEqual([0]);
  });

  it('detects class declarations', () => {
    const lines = ['// comment', 'export class MyClass {', '  constructor() {}', '}'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('detects Python functions', () => {
    const lines = ['import os', 'def my_func():', '    pass'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('detects Rust functions', () => {
    const lines = ['use std;', 'pub async fn handle() {', '}'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('detects Go functions', () => {
    const lines = ['package main', 'func main() {', '}'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('detects impl blocks', () => {
    const lines = ['impl Foo {', '  fn bar() {}', '}'];
    expect(findBoundaries(lines)).toEqual([0, 1]);
  });

  it('detects interfaces and types', () => {
    const lines = ['export interface Foo {', '}', 'export type Bar = string;'];
    expect(findBoundaries(lines)).toEqual([0, 2]);
  });

  it('handles indented boundaries', () => {
    const lines = ['module.exports = {', '  function helper() {', '  }', '}'];
    expect(findBoundaries(lines)).toEqual([1]);
  });

  it('returns empty for no boundaries', () => {
    const lines = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
    expect(findBoundaries(lines)).toEqual([]);
  });
});

describe('detectScopeName', () => {
  it('extracts function name', () => {
    const lines = ['function myFunc() {'];
    expect(detectScopeName(lines, 0)).toBe('myFunc');
  });

  it('extracts class name', () => {
    const lines = ['export class MyClass extends Base {'];
    expect(detectScopeName(lines, 0)).toBe('MyClass');
  });

  it('extracts Python def name', () => {
    const lines = ['def calculate():'];
    expect(detectScopeName(lines, 0)).toBe('calculate');
  });

  it('extracts impl name', () => {
    const lines = ['impl MyStruct {'];
    expect(detectScopeName(lines, 0)).toBe('MyStruct');
  });

  it('returns undefined for non-boundary line', () => {
    const lines = ['const x = 1;'];
    expect(detectScopeName(lines, 0)).toBeUndefined();
  });

  it('returns undefined for out-of-range', () => {
    const lines = ['function foo() {'];
    expect(detectScopeName(lines, 5)).toBeUndefined();
  });
});

describe('splitIntoChunks', () => {
  it('splits small text into a single chunk', () => {
    const text = 'line1\nline2\nline3';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.content).toBe('line1\nline2\nline3');
  });

  it('returns empty for empty text', () => {
    expect(splitIntoChunks('')).toEqual([]);
  });

  it('returns empty for whitespace-only text', () => {
    expect(splitIntoChunks('   \n  \n  ')).toEqual([]);
  });

  it('splits at function boundaries', () => {
    const lines: string[] = [];
    // 25 lines of code
    for (let i = 0; i < 25; i++) lines.push(`const x${String(i)} = ${String(i)};`);
    // function boundary
    lines.push('function foo() {');
    for (let i = 0; i < 25; i++) lines.push(`  const y${String(i)} = ${String(i)};`);
    lines.push('}');

    const chunks = splitIntoChunks(lines.join('\n'));
    // Should snap to boundary near line 25-26 (0-indexed)
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Second chunk should contain function foo
    const fooChunk = chunks.find((c) => c.scopeName === 'foo');
    expect(fooChunk).toBeDefined();
  });

  it('produces overlapping chunks', () => {
    const lines = Array.from({ length: 70 }, (_, i) => `line ${String(i)}`);
    const chunks = splitIntoChunks(lines.join('\n'), {
      overlapLines: 5,
      respectBoundaries: false,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Verify overlap: end of first chunk content appears in start of second
    if (chunks.length >= 2) {
      const firstLines = chunks[0]!.content.split('\n');
      const secondLines = chunks[1]!.content.split('\n');
      const lastFew = firstLines.slice(-5);
      const firstFew = secondLines.slice(0, 5);
      expect(firstFew).toEqual(lastFew);
    }
  });

  it('respects custom targetLines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${String(i)}`);
    const chunks = splitIntoChunks(lines.join('\n'), {
      targetLines: 10,
      overlapLines: 0,
      respectBoundaries: false,
    });
    expect(chunks).toHaveLength(2);
  });

  it('works with boundaries disabled', () => {
    const lines = Array.from({ length: 65 }, (_, i) => `const x${String(i)} = ${String(i)};`);
    // Insert a boundary mid-way
    lines[30] = 'function foo() {';
    const chunks = splitIntoChunks(lines.join('\n'), { respectBoundaries: false });
    // Should not snap to the function boundary
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('detects scope names in chunks', () => {
    const text = 'function myHelper() {\n  return 1;\n}';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.scopeName).toBe('myHelper');
  });

  it('handles single-line text', () => {
    const chunks = splitIntoChunks('hello');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(1);
  });

  it('does not produce infinite loop with many boundaries', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `function f${String(i)}() {}`);
    const chunks = splitIntoChunks(lines.join('\n'), { targetLines: 5, overlapLines: 2 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(200); // sanity check
  });
});
