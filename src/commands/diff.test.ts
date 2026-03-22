import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDiff } from './diff.js';
import { runGenerate } from './generate.js';
import type { ContextConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(tmpdir(), `contextai-diff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(dir: string, config: ContextConfig): void {
  const serialized = JSON.stringify(config, null, 2);
  writeFileSync(join(dir, 'context.config.ts'), `export default ${serialized};\n`);
}

const MINIMAL_CONFIG: ContextConfig = {
  project: { name: 'TestApp', stack: ['Node.js'], architecture: 'monolith' },
  conventions: {
    code: [{ title: 'Style', items: ['Use ESLint'] }],
  },
  outputs: {
    'AGENTS.md': true,
    'CLAUDE.md': false,
    '.cursorrules': false,
    '.github/copilot-instructions.md': false,
    'llms.txt': false,
  },
};

const projectConfigArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  stack: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  architecture: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('diff command — unit tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reports all in sync when generated files match on-disk files', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);
    // First generate the files
    await runGenerate(tmpDir);

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const result = await runDiff(tmpDir);

    expect(result.allInSync).toBe(true);
    expect(result.fileDiffs.every((fd) => !fd.result.hasChanges)).toBe(true);
    expect(stdoutChunks.join('')).toContain('All files are in sync.');
  });

  it('shows correct +/- diff when on-disk file differs from generated content', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);
    // Write a stale/different AGENTS.md
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# OldApp\n\nOld content here.\n');

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const result = await runDiff(tmpDir);

    expect(result.allInSync).toBe(false);
    const agentsDiff = result.fileDiffs.find((fd) => fd.outputPath === 'AGENTS.md');
    expect(agentsDiff).toBeDefined();
    expect(agentsDiff!.result.hasChanges).toBe(true);

    const output = stdoutChunks.join('');
    expect(output).toContain('AGENTS.md');
    // Lines added in new version should be prefixed with +
    expect(output).toMatch(/\+ /);
    // Lines removed from old version should be prefixed with -
    expect(output).toMatch(/- /);
  });

  it('treats missing on-disk file as all-added diff', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);
    // Do NOT generate files — AGENTS.md does not exist on disk

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const result = await runDiff(tmpDir);

    expect(result.allInSync).toBe(false);
    const agentsDiff = result.fileDiffs.find((fd) => fd.outputPath === 'AGENTS.md');
    expect(agentsDiff).toBeDefined();
    expect(agentsDiff!.result.hasChanges).toBe(true);

    // All hunks should be additions (+)
    for (const hunk of agentsDiff!.result.hunks) {
      for (const line of hunk.lines) {
        expect(line.type).toBe('+');
      }
    }

    const output = stdoutChunks.join('');
    expect(output).toContain('AGENTS.md');
    expect(output).toMatch(/\+ /);
    // No removal lines (lines starting with "- " as a diff marker, not markdown list items)
    expect(output).not.toMatch(/^- /m);
  });

  it('does not write any files to disk', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);

    const filesBefore = readdirSync(tmpDir);
    await runDiff(tmpDir);
    const filesAfter = readdirSync(tmpDir);

    expect(filesAfter).toEqual(filesBefore);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('diff command — property tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: contextai, Property 11: Diff is non-destructive (no disk writes)
  it('P11: diff does not write any files to disk', async () => {
    // Feature: contextai, Property 11: Diff is non-destructive (no disk writes)
    // Validates: Requirements 6.1
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          project: projectConfigArb,
          conventions: fc.constant({}),
          outputs: fc.record({
            'AGENTS.md': fc.boolean(),
            'CLAUDE.md': fc.boolean(),
            '.cursorrules': fc.boolean(),
            '.github/copilot-instructions.md': fc.boolean(),
            'llms.txt': fc.boolean(),
          }),
        }),
        async (config) => {
          const dir = makeTmpDir();
          try {
            writeConfig(dir, config);

            vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

            const filesBefore = readdirSync(dir).sort();
            await runDiff(dir);
            const filesAfter = readdirSync(dir).sort();

            expect(filesAfter).toEqual(filesBefore);
          } finally {
            rmSync(dir, { recursive: true, force: true });
            vi.restoreAllMocks();
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
