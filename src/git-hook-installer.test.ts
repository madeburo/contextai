import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DefaultGitHookInstaller } from './git-hook-installer';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'contextai-hook-test-'));
}

async function setupFakeGitRepo(dir: string): Promise<void> {
  await fs.mkdir(path.join(dir, '.git', 'hooks'), { recursive: true });
}

describe('DefaultGitHookInstaller', () => {
  let tmpDir: string;
  let installer: DefaultGitHookInstaller;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    installer = new DefaultGitHookInstaller();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates hook file with correct content when no existing hook', async () => {
    await setupFakeGitRepo(tmpDir);

    await installer.install(tmpDir);

    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    const content = await fs.readFile(hookPath, 'utf8');

    expect(content).toContain('# contextai');
    expect(content).toContain('contextai generate');
    expect(content).toContain("git add 'AGENTS.md' 'CLAUDE.md' '.cursorrules' '.github/copilot-instructions.md' 'llms.txt' 2>/dev/null || true");
  });

  it('makes the hook file executable', async () => {
    await setupFakeGitRepo(tmpDir);

    await installer.install(tmpDir);

    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    const stat = await fs.stat(hookPath);
    // Check owner execute bit (0o100)
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('appends contextai command to existing hook content', async () => {
    await setupFakeGitRepo(tmpDir);

    const existingContent = '#!/bin/sh\necho "existing hook"\n';
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    await fs.writeFile(hookPath, existingContent, 'utf8');

    await installer.install(tmpDir);

    const content = await fs.readFile(hookPath, 'utf8');

    // Existing content preserved
    expect(content).toContain('echo "existing hook"');
    // contextai block appended
    expect(content).toContain('# contextai');
    expect(content).toContain('contextai generate');
    // Existing content comes before contextai block
    expect(content.indexOf('echo "existing hook"')).toBeLessThan(content.indexOf('# contextai'));
  });

  it('adds newline separator when existing content does not end with newline', async () => {
    await setupFakeGitRepo(tmpDir);

    const existingContent = '#!/bin/sh\necho "no trailing newline"';
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    await fs.writeFile(hookPath, existingContent, 'utf8');

    await installer.install(tmpDir);

    const content = await fs.readFile(hookPath, 'utf8');
    // Should not have the contextai marker immediately after the last char without a newline
    expect(content).toContain('echo "no trailing newline"\n# contextai');
  });

  it('isInstalled returns false before install', async () => {
    await setupFakeGitRepo(tmpDir);

    const result = await installer.isInstalled(tmpDir);
    expect(result).toBe(false);
  });

  it('isInstalled returns true after install', async () => {
    await setupFakeGitRepo(tmpDir);

    await installer.install(tmpDir);

    const result = await installer.isInstalled(tmpDir);
    expect(result).toBe(true);
  });

  it('isInstalled returns false when hook exists but does not contain contextai marker', async () => {
    await setupFakeGitRepo(tmpDir);

    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    await fs.writeFile(hookPath, '#!/bin/sh\necho "other hook"\n', 'utf8');

    const result = await installer.isInstalled(tmpDir);
    expect(result).toBe(false);
  });

  it('throws when .git directory is not found', async () => {
    // tmpDir has no .git directory
    await expect(installer.install(tmpDir)).rejects.toThrow(
      'Not a git repository: .git directory not found'
    );
  });
});
