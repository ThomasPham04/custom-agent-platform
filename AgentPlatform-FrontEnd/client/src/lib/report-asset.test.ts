import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePdf = join(__dirname, '..', '..', '..', '..', 'documents', 'ai-agent-platform-report.pdf');
const publicPdf = join(
  __dirname,
  '..',
  '..',
  'public',
  'documents',
  'ai-agent-platform-report.pdf',
);

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('platform report asset', () => {
  it('publishes the current source report for the sidebar link', () => {
    expect(existsSync(publicPdf)).toBe(true);
    expect(sha256(publicPdf)).toBe(sha256(sourcePdf));
  });
});
