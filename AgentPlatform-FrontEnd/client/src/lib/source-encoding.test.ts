import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards against mojibake: UTF-8 source that was once decoded as cp1252 and
 * written back, turning "⌄" into "âŒ„". It renders as garbage next to the agent
 * name and no type checker or linter notices, so the check lives here.
 *
 * "Ã" and "â" followed by another high character is the signature of the
 * double-encoding; no real word in this codebase produces that pair.
 */
const MOJIBAKE = /[ÃâÅ][-ÿŒ-Ÿ‐-⃿]/;

const SOURCE_ROOT = join(__dirname, '..');
const EXTENSIONS = ['.ts', '.tsx', '.css'];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    // This file quotes mojibake to describe it, so it cannot check itself.
    if (path === __filename) return [];
    return EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });

describe('source encoding', () => {
  it('has no double-encoded UTF-8 characters', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .flatMap(({ path, text }) =>
        text
          .split('\n')
          .map((line, index) => ({ path, line: index + 1, text: line }))
          .filter((entry) => MOJIBAKE.test(entry.text)),
      )
      .map((entry) => `${entry.path}:${entry.line}: ${entry.text.trim()}`);

    expect(offenders).toEqual([]);
  });
});
