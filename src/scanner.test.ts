import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DefaultScanner } from './scanner.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'contextai-scanner-'));
}

async function writeFile(dir: string, name: string, content = ''): Promise<void> {
  const filePath = path.join(dir, name);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('DefaultScanner', () => {
  let tmpDir: string;
  let scanner: DefaultScanner;

  beforeEach(async () => {
    tmpDir = await mkTmpDir();
    scanner = new DefaultScanner();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null packageJson when package.json is absent', async () => {
    const result = await scanner.scan(tmpDir);
    expect(result.packageJson).toBeNull();
  });

  it('reads and parses package.json', async () => {
    await writeFile(tmpDir, 'package.json', JSON.stringify({ name: 'my-app', version: '1.0.0' }));
    const result = await scanner.scan(tmpDir);
    expect(result.packageJson).toEqual({ name: 'my-app', version: '1.0.0' });
  });

  it('detects TypeScript when tsconfig.json exists', async () => {
    await writeFile(tmpDir, 'tsconfig.json', '{}');
    const result = await scanner.scan(tmpDir);
    expect(result.hasTypeScript).toBe(true);
  });

  it('hasTypeScript is false when tsconfig.json is absent', async () => {
    const result = await scanner.scan(tmpDir);
    expect(result.hasTypeScript).toBe(false);
  });

  it('detects Prisma when prisma/schema.prisma exists', async () => {
    await writeFile(tmpDir, 'prisma/schema.prisma', 'datasource db {}');
    const result = await scanner.scan(tmpDir);
    expect(result.hasPrisma).toBe(true);
  });

  it('hasPrisma is false when schema.prisma is absent', async () => {
    const result = await scanner.scan(tmpDir);
    expect(result.hasPrisma).toBe(false);
  });

  it('returns empty detectedFrameworks when no indicator files exist', async () => {
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toEqual([]);
  });

  it('detects nextjs from next.config.js', async () => {
    await writeFile(tmpDir, 'next.config.js', '');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('nextjs');
  });

  it('detects nextjs from next.config.ts', async () => {
    await writeFile(tmpDir, 'next.config.ts', '');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('nextjs');
  });

  it('detects nestjs from nest-cli.json', async () => {
    await writeFile(tmpDir, 'nest-cli.json', '{}');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('nestjs');
  });

  it('detects sveltekit from svelte.config.js', async () => {
    await writeFile(tmpDir, 'svelte.config.js', '');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('sveltekit');
  });

  it('detects remix from remix.config.js', async () => {
    await writeFile(tmpDir, 'remix.config.js', '');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('remix');
  });

  it('detects multiple frameworks simultaneously', async () => {
    await writeFile(tmpDir, 'next.config.js', '');
    await writeFile(tmpDir, 'nest-cli.json', '{}');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks).toContain('nextjs');
    expect(result.detectedFrameworks).toContain('nestjs');
  });

  it('does not duplicate a framework when multiple indicator files match', async () => {
    await writeFile(tmpDir, 'next.config.js', '');
    await writeFile(tmpDir, 'next.config.ts', '');
    const result = await scanner.scan(tmpDir);
    expect(result.detectedFrameworks.filter(f => f === 'nextjs')).toHaveLength(1);
  });
});
