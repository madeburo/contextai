import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGenerate, buildGenerators } from './generate.js';
import type { ContextConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(tmpdir(), `contextai-gen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(dir: string, config: ContextConfig): void {
  const serialized = JSON.stringify(config, null, 2);
  writeFileSync(
    join(dir, 'context.config.ts'),
    `export default ${serialized};\n`
  );
}

const MINIMAL_CONFIG: ContextConfig = {
  project: { name: 'TestApp', stack: ['Node.js'], architecture: 'monolith' },
  conventions: {
    code: [{ title: 'Style', items: ['Use ESLint'] }],
  },
  outputs: {
    'AGENTS.md': true,
    'CLAUDE.md': true,
    '.cursorrules': true,
    '.github/copilot-instructions.md': true,
    'llms.txt': true,
  },
};

// ---------------------------------------------------------------------------
// fast-check arbitraries
// ---------------------------------------------------------------------------

const projectConfigArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  stack: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  architecture: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
});

const outputsConfigArb = fc.record({
  'AGENTS.md': fc.boolean(),
  'CLAUDE.md': fc.boolean(),
  '.cursorrules': fc.boolean(),
  '.github/copilot-instructions.md': fc.boolean(),
  'llms.txt': fc.boolean(),
  '.windsurf/rules': fc.boolean(),
  'GEMINI.md': fc.boolean(),
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('generate command — unit tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes all five enabled generators for a known fixture', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);

    const result = await runGenerate(tmpDir);

    expect(result.errors).toHaveLength(0);
    expect(result.writtenFiles).toContain('AGENTS.md');
    expect(result.writtenFiles).toContain('CLAUDE.md');
    expect(result.writtenFiles).toContain('.cursorrules');
    expect(result.writtenFiles).toContain('.github/copilot-instructions.md');
    expect(result.writtenFiles).toContain('llms.txt');

    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursorrules'))).toBe(true);
    expect(existsSync(join(tmpDir, '.github/copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'llms.txt'))).toBe(true);
  });

  it('dry-run prints content and writes nothing', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const result = await runGenerate(tmpDir, { dryRun: true });

    expect(result.writtenFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    // No files written to disk
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);

    const output = stdoutChunks.join('');
    expect(output).toContain('No files written');
    expect(output).toContain('AGENTS.md');
    expect(output).toContain('CLAUDE.md');
  });

  it('custom generator is invoked and written', async () => {
    writeFileSync(
      join(tmpDir, 'context.config.ts'),
      `export default {
  project: { name: 'TestApp', stack: ['Node.js'], architecture: 'monolith' },
  conventions: { code: [{ title: 'Style', items: ['Use ESLint'] }] },
  outputs: {
    'AGENTS.md': false,
    'CLAUDE.md': false,
    '.cursorrules': false,
    '.github/copilot-instructions.md': false,
    'llms.txt': false,
    custom: [
      { path: 'custom-output.txt', generator: () => 'custom content\\n' },
    ],
  },
};\n`
    );

    const result = await runGenerate(tmpDir);

    expect(result.errors).toHaveLength(0);
    expect(result.writtenFiles).toContain('custom-output.txt');
    expect(existsSync(join(tmpDir, 'custom-output.txt'))).toBe(true);
    expect(readFileSync(join(tmpDir, 'custom-output.txt'), 'utf-8')).toBe('custom content\n');
  });

  it('single write failure reports error but remaining generators complete', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);

    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Make AGENTS.md a directory so writing to it fails
    mkdirSync(join(tmpDir, 'AGENTS.md'));

    const result = await runGenerate(tmpDir);

    // AGENTS.md should have failed
    expect(result.errors.some((e) => e.outputPath === 'AGENTS.md')).toBe(true);
    // Other generators should still have written
    expect(result.writtenFiles).toContain('CLAUDE.md');
    expect(result.writtenFiles).toContain('.cursorrules');
    expect(result.writtenFiles).toContain('.github/copilot-instructions.md');
    expect(result.writtenFiles).toContain('llms.txt');
  });

  it('only enabled generators are invoked', async () => {
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: {
        'AGENTS.md': true,
        'CLAUDE.md': false,
        '.cursorrules': false,
        '.github/copilot-instructions.md': false,
        'llms.txt': false,
      },
    };
    writeConfig(tmpDir, config);

    const result = await runGenerate(tmpDir);

    expect(result.writtenFiles).toEqual(['AGENTS.md']);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(tmpDir, '.cursorrules'))).toBe(false);
  });

  it('writes windsurf and gemini generators when enabled', async () => {
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: {
        'AGENTS.md': false,
        '.windsurf/rules': true,
        'GEMINI.md': true,
      },
    };
    writeConfig(tmpDir, config);

    const result = await runGenerate(tmpDir);

    expect(result.errors).toHaveLength(0);
    expect(result.writtenFiles).toContain('.windsurf/rules');
    expect(result.writtenFiles).toContain('GEMINI.md');
    expect(existsSync(join(tmpDir, '.windsurf/rules/project-context.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'GEMINI.md'))).toBe(true);

    const windsurfContent = readFileSync(join(tmpDir, '.windsurf/rules/project-context.md'), 'utf-8');
    expect(windsurfContent).toContain('trigger: always_on');
    expect(windsurfContent).toContain('TestApp');

    const geminiContent = readFileSync(join(tmpDir, 'GEMINI.md'), 'utf-8');
    expect(geminiContent).toContain('TestApp');
    expect(geminiContent).not.toContain('---');
  });

  it('--format json outputs JSON IR to stdout and writes nothing', async () => {
    writeConfig(tmpDir, MINIMAL_CONFIG);

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const result = await runGenerate(tmpDir, { format: 'json' });

    expect(result.writtenFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    // No files written to disk
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(false);

    const output = stdoutChunks.join('');
    const ir = JSON.parse(output);
    expect(ir.version).toBeDefined();
    expect(ir.generatedAt).toBeDefined();
    expect(ir.config).toBeDefined();
    expect(ir.outputs).toBeInstanceOf(Array);
    expect(ir.outputs.length).toBeGreaterThan(0);
    expect(ir.outputs[0].path).toBeDefined();
    expect(ir.outputs[0].content).toBeDefined();
  });

  it('applies templates when config.templates is set', async () => {
    writeFileSync(
      join(tmpDir, 'context.config.ts'),
      `export default {
  project: { name: 'TestApp', stack: ['Next.js'], architecture: 'SSR' },
  conventions: {},
  outputs: { 'AGENTS.md': true },
  templates: ['nextjs'],
};\n`
    );

    const result = await runGenerate(tmpDir);
    expect(result.errors).toHaveLength(0);
    expect(result.writtenFiles).toContain('AGENTS.md');

    const content = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('TestApp');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// These tests exercise the core logic of buildGenerators and the generator
// adapters directly (no file-system config loading) to keep them fast.
// ---------------------------------------------------------------------------

describe('generate command — property tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: contextai, Property 6: Only enabled generators are invoked during generate
  it('P6: only enabled generators are included by buildGenerators', () => {
    // Feature: contextai, Property 6: Only enabled generators are invoked during generate
    // Validates: Requirements 4.1
    fc.assert(
      fc.property(
        fc.record({
          project: projectConfigArb,
          conventions: fc.constant({}),
          outputs: outputsConfigArb,
        }),
        (config) => {
          const generators = buildGenerators(config);

          const enabledKeys = Object.entries(config.outputs)
            .filter(([k, v]) => k !== 'custom' && v === true)
            .map(([k]) => k);

          const generatorKeys = generators.map((g) => g.outputPath);

          // Every generator returned must correspond to an enabled key
          for (const key of generatorKeys) {
            expect(enabledKeys).toContain(key);
          }

          // Every enabled key must have a corresponding generator
          for (const key of enabledKeys) {
            expect(generatorKeys).toContain(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: contextai, Property 6a: Dry-run produces no disk writes
  it('P6a: dry-run produces no disk writes', async () => {
    // Feature: contextai, Property 6a: Dry-run produces no disk writes
    // Validates: Requirements 4.9, 4.10
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          project: projectConfigArb,
          conventions: fc.constant({}),
          outputs: outputsConfigArb,
        }),
        async (config) => {
          const dir = makeTmpDir();
          try {
            writeConfig(dir, config);

            const stdoutChunks: string[] = [];
            const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
              stdoutChunks.push(String(chunk));
              return true;
            });

            const result = await runGenerate(dir, { dryRun: true });
            spy.mockRestore();

            // No files written
            expect(result.writtenFiles).toHaveLength(0);

            // No output files exist on disk
            const outputKeys = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'llms.txt', '.windsurf/rules', 'GEMINI.md'];
            for (const key of outputKeys) {
              expect(existsSync(join(dir, key))).toBe(false);
            }

            // "no files written" notice printed
            const output = stdoutChunks.join('');
            expect(output).toMatch(/No (files written|generators to run)/i);
          } finally {
            rmSync(dir, { recursive: true, force: true });
            vi.restoreAllMocks();
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  // Feature: contextai, Property 6b: Custom generators are invoked and written
  it('P6b: custom generators are invoked and written', async () => {
    // Feature: contextai, Property 6b: Custom generators are invoked and written
    // Validates: Requirements 12.2

    // Build valid filenames directly instead of filtering random strings
    const filenameArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
      { minLength: 1, maxLength: 15 }
    ).map((base) => `${base}.txt`);

    await fc.assert(
      fc.asyncProperty(
        projectConfigArb,
        fc.array(
          fc.record({
            path: filenameArb,
            content: fc.string({ minLength: 0, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (project, customDefs) => {
          const dir = makeTmpDir();
          try {
            // Deduplicate paths
            const seen = new Set<string>();
            const unique = customDefs.filter((d) => {
              if (seen.has(d.path)) return false;
              seen.add(d.path);
              return true;
            });

            const generators = buildGenerators({
              project,
              conventions: {},
              outputs: {
                'AGENTS.md': false,
                'CLAUDE.md': false,
                '.cursorrules': false,
                '.github/copilot-instructions.md': false,
                'llms.txt': false,
                custom: unique.map((d) => ({
                  path: d.path,
                  generator: () => d.content,
                })),
              },
            });

            const config: ContextConfig = { project, conventions: {}, outputs: {} };

            for (const gen of generators) {
              await gen.write(config, dir);
            }

            for (const d of unique) {
              expect(existsSync(join(dir, d.path))).toBe(true);
              expect(readFileSync(join(dir, d.path), 'utf-8')).toBe(d.content);
            }
          } finally {
            rmSync(dir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  // Feature: contextai, Property 7: Generator write failures do not abort remaining generators
  it('P7: write failure in one generator does not abort remaining generators', async () => {
    // Feature: contextai, Property 7: Generator write failures do not abort remaining generators
    // Validates: Requirements 4.8
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 4 }),
        async (failIndex) => {
          const dir = makeTmpDir();
          try {
            const config: ContextConfig = {
              project: { name: 'TestApp', stack: ['Node.js'], architecture: 'monolith' },
              conventions: { code: [{ title: 'Style', items: ['Use ESLint'] }] },
              outputs: {
                'AGENTS.md': true,
                'CLAUDE.md': true,
                '.cursorrules': true,
                '.github/copilot-instructions.md': true,
                'llms.txt': true,
              },
            };
            writeConfig(dir, config);

            const outputKeys = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'llms.txt'];
            const failKey = outputKeys[failIndex]!;

            // Make the failing output path a directory so writing to it fails
            mkdirSync(join(dir, failKey), { recursive: true });

            vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

            const result = await runGenerate(dir);
            vi.restoreAllMocks();

            // The failing generator should be in errors
            expect(result.errors.some((e) => e.outputPath === failKey)).toBe(true);

            // All other generators should have succeeded
            const otherKeys = outputKeys.filter((k) => k !== failKey);
            for (const key of otherKeys) {
              expect(result.writtenFiles).toContain(key);
            }
          } finally {
            rmSync(dir, { recursive: true, force: true });
            vi.restoreAllMocks();
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
