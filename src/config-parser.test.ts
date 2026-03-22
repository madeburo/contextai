import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DefaultConfigParser } from './config-parser.js';
import { ConfigParseError, ConfigValidationError } from './errors.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `contextai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('DefaultConfigParser', () => {
  let tmpDir: string;
  let parser: DefaultConfigParser;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    parser = new DefaultConfigParser();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads a valid config correctly', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
      export default {
        project: { name: 'MyApp', stack: ['Node.js', 'TypeScript'], architecture: 'monolith' },
        conventions: {
          code: [{ title: 'Style', items: ['Use ESLint'] }],
        },
        outputs: { 'AGENTS.md': true },
      };
    `);

    const config = await parser.load(configPath);

    expect(config.project.name).toBe('MyApp');
    expect(config.project.stack).toEqual(['Node.js', 'TypeScript']);
    expect(config.project.architecture).toBe('monolith');
    expect(config.conventions.code[0].title).toBe('Style');
    expect(config.outputs['AGENTS.md']).toBe(true);
  });

  it('throws ConfigParseError with file path when default export is missing', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    // Named export only — no default export
    writeFileSync(configPath, `export const foo = 42;`);

    await expect(parser.load(configPath)).rejects.toThrow(ConfigParseError);

    try {
      await parser.load(configPath);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigParseError);
      const parseErr = err as ConfigParseError;
      expect(parseErr.filePath).toBe(configPath);
      expect(parseErr.message).toContain(configPath);
      expect(parseErr.message.toLowerCase()).toMatch(/default export|no default/);
    }
  });

  it('throws ConfigParseError with file path and line number on syntax error', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
export default {
  project: { name: 'Test'
  // missing closing brace — syntax error
`);

    await expect(parser.load(configPath)).rejects.toThrow(ConfigParseError);

    try {
      await parser.load(configPath);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigParseError);
      const parseErr = err as ConfigParseError;
      expect(parseErr.filePath).toBe(configPath);
      // line should be a non-negative number
      expect(typeof parseErr.line).toBe('number');
      expect(parseErr.line).toBeGreaterThanOrEqual(0);
    }
  });

  it('throws ConfigValidationError with field name on unknown field', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
      export default {
        project: { name: 'MyApp', stack: ['Node.js'], architecture: 'monolith' },
        conventions: {},
        outputs: {},
        unknownField: 'this should not be here',
      };
    `);

    await expect(parser.load(configPath)).rejects.toThrow(ConfigValidationError);

    try {
      await parser.load(configPath);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const validationErr = err as ConfigValidationError;
      expect(validationErr.filePath).toBe(configPath);
      expect(validationErr.invalidField).toBe('unknownField');
      expect(validationErr.message).toContain('unknownField');
    }
  });

  it('throws ConfigValidationError for unknown nested field', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
      export default {
        project: { name: 'MyApp', stack: ['Node.js'], architecture: 'monolith', extraProp: true },
        conventions: {},
        outputs: {},
      };
    `);

    await expect(parser.load(configPath)).rejects.toThrow(ConfigValidationError);

    try {
      await parser.load(configPath);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const validationErr = err as ConfigValidationError;
      // Zod reports nested unknown fields as "project.extraProp"
      expect(validationErr.invalidField).toContain('extraProp');
      expect(validationErr.message).toContain('extraProp');
    }
  });

  it('loads config with optional templates field', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
      export default {
        project: { name: 'MyApp', stack: ['Next.js'], architecture: 'SSR' },
        conventions: {},
        outputs: { 'CLAUDE.md': true },
        templates: ['nextjs'],
      };
    `);

    const config = await parser.load(configPath);
    expect(config.templates).toEqual(['nextjs']);
  });

  it('loads config with convention sections including scope', async () => {
    const configPath = join(tmpDir, 'context.config.ts');
    writeFileSync(configPath, `
      export default {
        project: { name: 'MyApp', stack: ['Node.js'], architecture: 'monolith' },
        conventions: {
          code: [
            { title: 'Agent tips', items: ['Use types'], scope: 'agent-only' },
            { title: 'Human notes', items: ['Read docs'], scope: 'human-only' },
          ],
        },
        outputs: {},
      };
    `);

    const config = await parser.load(configPath);
    expect(config.conventions.code[0].scope).toBe('agent-only');
    expect(config.conventions.code[1].scope).toBe('human-only');
  });
});
