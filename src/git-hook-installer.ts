import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const HOOK_MARKER = '# contextai';

const DEFAULT_OUTPUT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
  'llms.txt',
];

/** Shell-quote a filename so spaces and special chars are safe in sh scripts. */
function shellQuote(s: string): string {
  // Wrap in single quotes; escape any embedded single quotes via '\''
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function buildHookScript(outputFiles?: string[]): string {
  const files = outputFiles ?? DEFAULT_OUTPUT_FILES;
  const gitAddList = files.map(shellQuote).join(' ');
  return `# contextai
contextai generate
git add ${gitAddList} 2>/dev/null || true
`;
}

export interface GitHookInstaller {
  install(projectRoot: string, outputFiles?: string[]): Promise<void>;
  isInstalled(projectRoot: string): Promise<boolean>;
}

export class DefaultGitHookInstaller implements GitHookInstaller {
  async install(projectRoot: string, outputFiles?: string[]): Promise<void> {
    const resolvedRoot = path.resolve(projectRoot);
    const gitDir = path.join(resolvedRoot, '.git');

    try {
      const stat = await fs.stat(gitDir);
      if (!stat.isDirectory()) {
        throw new Error(`Not a git repository: .git directory not found`);
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Not a git repository: .git directory not found`);
      }
      throw err;
    }

    const hookScript = buildHookScript(outputFiles);
    const hookPath = path.join(gitDir, 'hooks', 'pre-commit');

    // Ensure hooks directory exists
    await fs.mkdir(path.join(gitDir, 'hooks'), { recursive: true });

    let content: string;
    try {
      const existing = await fs.readFile(hookPath, 'utf8');
      // Skip if already installed to prevent duplicate blocks
      if (existing.includes(HOOK_MARKER)) {
        return;
      }
      // Append: ensure there's a newline separator before the block
      const separator = existing.endsWith('\n') ? '' : '\n';
      content = existing + separator + hookScript;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        content = `#!/bin/sh\n${hookScript}`;
      } else {
        throw err;
      }
    }

    await fs.writeFile(hookPath, content, 'utf8');
    await fs.chmod(hookPath, 0o755);
  }

  async isInstalled(projectRoot: string): Promise<boolean> {
    const resolvedRoot = path.resolve(projectRoot);
    const hookPath = path.join(resolvedRoot, '.git', 'hooks', 'pre-commit');
    try {
      const content = await fs.readFile(hookPath, 'utf8');
      return content.includes(HOOK_MARKER);
    } catch {
      return false;
    }
  }
}
