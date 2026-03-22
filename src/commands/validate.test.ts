import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, mkdirSync as mkdirSyncFs } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runValidate } from './validate.js';
import type { ContextConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(tmpdir(), `contextai-validate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(dir: string, config: ContextConfig): void {
  const serialized = JSON.stringify(config, null, 2);
  writeFileSync(join(dir, 'context.config.ts'), `export default ${serialized};\n`);
}

async function setMtime(filePath: string, date: Date): Promise<void> {
  await fs.utimes(filePath, date, date);
}

const MINIMAL_CONFIG: ContextConfig = {
  project: { name: 'TestApp', stack: ['Node.js'], architecture: 'Monolith' },
  conventions: { code: [{ title: 'Style', items: ['Use TypeScript'] }] },
  outputs: { 'AGENTS.md': true },
};

// Valid AGENTS.md content with all required headers
const VALID_AGENTS_MD = `# TestApp\n\n## Stack\n\n- Node.js\n\n## Architecture\n\nMonolith\n\n## Conventions\n\n### Style\n\n- Use TypeScript\n`;

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('validate command — unit tests', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns success when all enabled outputs exist, are fresh, and have correct headers', async () => {
    tmpDir = makeTmpDir();
    writeConfig(tmpDir, MINIMAL_CONFIG);

    // Make config older than output
    const past = new Date(Date.now() - 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), past);

    writeFileSync(join(tmpDir, 'AGENTS.md'), VALID_AGENTS_MD);

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing error when enabled output does not exist', async () => {
    tmpDir = makeTmpDir();
    writeConfig(tmpDir, MINIMAL_CONFIG);

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(false);
    const err = result.errors.find(e => e.type === 'missing');
    expect(err).toBeDefined();
    expect(err?.outputPath).toBe('AGENTS.md');
    expect(err?.message).toContain('AGENTS.md');
  });

  it('reports stale error when output file is older than config', async () => {
    tmpDir = makeTmpDir();
    writeConfig(tmpDir, MINIMAL_CONFIG);
    writeFileSync(join(tmpDir, 'AGENTS.md'), VALID_AGENTS_MD);

    // Make config newer than output
    const future = new Date(Date.now() + 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), future);

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(false);
    const err = result.errors.find(e => e.type === 'stale');
    expect(err).toBeDefined();
    expect(err?.outputPath).toBe('AGENTS.md');
    expect(err?.message).toContain('contextai generate');
  });

  it('reports missing-header error when output file lacks expected headers', async () => {
    tmpDir = makeTmpDir();
    writeConfig(tmpDir, MINIMAL_CONFIG);

    // Make config older so freshness check passes
    const past = new Date(Date.now() - 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), past);

    writeFileSync(join(tmpDir, 'AGENTS.md'), '# TestApp\n\nSome content without required headers\n');

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(false);
    const headerErrors = result.errors.filter(e => e.type === 'missing-header');
    expect(headerErrors.length).toBeGreaterThan(0);
    expect(headerErrors[0]?.outputPath).toBe('AGENTS.md');
    expect(headerErrors[0]?.header).toBeDefined();
    expect(headerErrors[0]?.message).toContain('AGENTS.md');
  });

  it('does not check disabled outputs', async () => {
    tmpDir = makeTmpDir();
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: { 'AGENTS.md': false },
    };
    writeConfig(tmpDir, config);

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports multiple missing errors across multiple enabled outputs', async () => {
    tmpDir = makeTmpDir();
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: { 'AGENTS.md': true, 'CLAUDE.md': true },
    };
    writeConfig(tmpDir, config);

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(false);
    const missingErrors = result.errors.filter(e => e.type === 'missing');
    expect(missingErrors).toHaveLength(2);
    const paths = missingErrors.map(e => e.outputPath);
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('CLAUDE.md');
  });

  it('checks correct headers for .cursorrules format', async () => {
    tmpDir = makeTmpDir();
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: { '.cursorrules': true },
    };
    writeConfig(tmpDir, config);

    const past = new Date(Date.now() - 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), past);

    // Write cursorrules with all required headers
    writeFileSync(join(tmpDir, '.cursorrules'), 'PROJECT: TestApp\nSTACK: Node.js\nARCHITECTURE: Monolith\n');

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('checks correct headers for llms.txt format', async () => {
    tmpDir = makeTmpDir();
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: { 'llms.txt': true },
    };
    writeConfig(tmpDir, config);

    const past = new Date(Date.now() - 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), past);

    writeFileSync(join(tmpDir, 'llms.txt'), '# TestApp\n\n## Stack\n\n- Node.js\n\n## Links\n');

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('checks correct headers for .github/copilot-instructions.md', async () => {
    tmpDir = makeTmpDir();
    const config: ContextConfig = {
      ...MINIMAL_CONFIG,
      outputs: { '.github/copilot-instructions.md': true },
    };
    writeConfig(tmpDir, config);

    const past = new Date(Date.now() - 10000);
    await setMtime(join(tmpDir, 'context.config.ts'), past);

    mkdirSyncFs(join(tmpDir, '.github'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.github/copilot-instructions.md'),
      '---\napplyTo: "**"\n---\n\n# TestApp\n\n## Stack\n\n- Node.js\n\n## Architecture\n\nMonolith\n\n## Conventions\n\n### Style\n\n- Use TypeScript\n'
    );

    const result = await runValidate(tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
