import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from './init.js';
import type { InitPrompts } from './init.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `contextai-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Build a minimal injectable prompts object with sensible defaults. */
function makePrompts(overrides: Partial<{
  name: string;
  stack: string;
  outputs: string[];
  gitHook: boolean;
  overwrite: boolean;
}>): InitPrompts {
  const {
    name = 'my-app',
    stack = 'Node.js',
    outputs = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'llms.txt'],
    gitHook = false,
    overwrite = true,
  } = overrides;

  return {
    async input(opts) {
      if (opts.message.toLowerCase().includes('name')) return name;
      if (opts.message.toLowerCase().includes('stack')) return stack;
      return opts.default ?? '';
    },
    async checkbox(_opts) {
      return outputs;
    },
    async confirm(opts) {
      if (opts.message.toLowerCase().includes('overwrite')) return overwrite;
      if (opts.message.toLowerCase().includes('hook')) return gitHook;
      return opts.default ?? false;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // 1. Basic prompt flow — config written to disk with correct content
  // -------------------------------------------------------------------------

  it('writes context.config.ts with collected values', async () => {
    const result = await runInit(tmpDir, {
      prompts: makePrompts({ name: 'my-project', stack: 'Next.js, TypeScript' }),
    });

    expect(result.configPath).toBe(join(tmpDir, 'context.config.ts'));
    expect(existsSync(result.configPath)).toBe(true);

    const content = readFileSync(result.configPath, 'utf-8');
    expect(content).toContain("name: 'my-project'");
    expect(content).toContain("'Next.js'");
    expect(content).toContain("'TypeScript'");
    expect(content).toContain("import { defineContext } from 'contextai'");
    expect(content).toContain('export default defineContext(');
  });

  it('includes only selected output keys', async () => {
    const result = await runInit(tmpDir, {
      prompts: makePrompts({ outputs: ['AGENTS.md', 'CLAUDE.md'] }),
    });

    const content = readFileSync(result.configPath, 'utf-8');
    expect(content).toContain("'AGENTS.md': true");
    expect(content).toContain("'CLAUDE.md': true");
    expect(content).toContain("'.cursorrules': false");
    expect(content).toContain("'.github/copilot-instructions.md': false");
    expect(content).toContain("'llms.txt': false");
  });

  it('returns installedGitHook: false when user declines hook', async () => {
    const result = await runInit(tmpDir, {
      prompts: makePrompts({ gitHook: false }),
    });
    expect(result.installedGitHook).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 2. Existing config triggers overwrite confirmation
  // -------------------------------------------------------------------------

  it('prompts for overwrite when context.config.ts already exists', async () => {
    // Pre-create the config file
    writeFileSync(join(tmpDir, 'context.config.ts'), '// existing content\n');

    let overwritePromptCalled = false;
    const prompts: InitPrompts = {
      async input(opts) {
        if (opts.message.toLowerCase().includes('name')) return 'new-app';
        if (opts.message.toLowerCase().includes('stack')) return 'Node.js';
        return opts.default ?? '';
      },
      async checkbox() {
        return ['AGENTS.md'];
      },
      async confirm(opts) {
        if (opts.message.toLowerCase().includes('overwrite')) {
          overwritePromptCalled = true;
          return true; // confirm overwrite
        }
        return false;
      },
    };

    await runInit(tmpDir, { prompts });
    expect(overwritePromptCalled).toBe(true);
  });

  it('does not overwrite when user declines overwrite confirmation', async () => {
    const originalContent = '// existing content\n';
    writeFileSync(join(tmpDir, 'context.config.ts'), originalContent);

    const result = await runInit(tmpDir, {
      prompts: makePrompts({ overwrite: false }),
    });

    // File should be unchanged
    const content = readFileSync(result.configPath, 'utf-8');
    expect(content).toBe(originalContent);
  });

  // -------------------------------------------------------------------------
  // 3. Detected framework pre-populates template name in written config
  // -------------------------------------------------------------------------

  it('pre-populates template name when a known framework is detected', async () => {
    // Create a next.config.js to trigger Next.js detection
    writeFileSync(join(tmpDir, 'next.config.js'), 'module.exports = {};\n');

    const result = await runInit(tmpDir, {
      prompts: makePrompts({ name: 'next-app', stack: 'Next.js' }),
    });

    const content = readFileSync(result.configPath, 'utf-8');
    // The detected template name should appear in the templates array
    expect(content).toContain("'nextjs'");
  });

  it('includes template conventions in config when framework is detected', async () => {
    // Create nest-cli.json to trigger NestJS detection
    writeFileSync(join(tmpDir, 'nest-cli.json'), '{}');

    const result = await runInit(tmpDir, {
      prompts: makePrompts({ name: 'nest-app', stack: 'NestJS' }),
    });

    const content = readFileSync(result.configPath, 'utf-8');
    // Should have nestjs template name
    expect(content).toContain("'nestjs'");
    // Conventions from the template should be present
    expect(content).toContain('conventions');
  });

  // -------------------------------------------------------------------------
  // 4. Default values from package.json
  // -------------------------------------------------------------------------

  it('uses package.json name as default for project name prompt', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'pkg-name', version: '1.0.0' })
    );

    let capturedDefault: string | undefined;
    const prompts: InitPrompts = {
      async input(opts) {
        if (opts.message.toLowerCase().includes('name')) {
          capturedDefault = opts.default;
          return opts.default ?? 'fallback';
        }
        return opts.default ?? 'Node.js';
      },
      async checkbox() {
        return ['AGENTS.md'];
      },
      async confirm() {
        return false;
      },
    };

    await runInit(tmpDir, { prompts });
    expect(capturedDefault).toBe('pkg-name');
  });

  // -------------------------------------------------------------------------
  // 5. No framework detected — no templates field in output
  // -------------------------------------------------------------------------

  it('omits templates field when no framework is detected', async () => {
    const result = await runInit(tmpDir, {
      prompts: makePrompts({ name: 'plain-app', stack: 'Node.js' }),
    });

    const content = readFileSync(result.configPath, 'utf-8');
    expect(content).not.toContain('templates:');
  });
});
