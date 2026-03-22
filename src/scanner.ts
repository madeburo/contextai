import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Scanner, ScanResult, FrameworkName } from './types.js';

/** Frameworks detected by the presence of specific config files. */
const FILE_INDICATORS: Array<{ framework: FrameworkName; patterns: string[] }> = [
  { framework: 'nextjs', patterns: ['next.config.js', 'next.config.ts', 'next.config.mjs', 'next.config.cjs'] },
  { framework: 'nestjs', patterns: ['nest-cli.json'] },
  { framework: 'sveltekit', patterns: ['svelte.config.js', 'svelte.config.ts', 'svelte.config.mjs'] },
  { framework: 'remix', patterns: ['remix.config.js', 'remix.config.ts', 'remix.config.mjs'] },
];

/** Frameworks detected by their presence in package.json dependencies. */
const DEP_INDICATORS: Array<{ framework: FrameworkName; packages: string[] }> = [
  { framework: 'express', packages: ['express'] },
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class DefaultScanner implements Scanner {
  async scan(projectRoot: string): Promise<ScanResult> {
    const [packageJson, hasTypeScript, hasPrisma, fileFrameworks] = await Promise.all([
      this.readPackageJson(projectRoot),
      fileExists(path.join(projectRoot, 'tsconfig.json')),
      fileExists(path.join(projectRoot, 'prisma', 'schema.prisma')),
      this.detectFrameworksByFile(projectRoot),
    ]);

    const depFrameworks = this.detectFrameworksByDep(packageJson);
    const detectedFrameworks = [...new Set([...fileFrameworks, ...depFrameworks])];

    return { detectedFrameworks, hasTypeScript, hasPrisma, packageJson };
  }

  private async readPackageJson(projectRoot: string): Promise<Record<string, unknown> | null> {
    try {
      const content = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async detectFrameworksByFile(projectRoot: string): Promise<FrameworkName[]> {
    const detected: FrameworkName[] = [];

    for (const { framework, patterns } of FILE_INDICATORS) {
      for (const pattern of patterns) {
        if (await fileExists(path.join(projectRoot, pattern))) {
          detected.push(framework);
          break;
        }
      }
    }

    return detected;
  }

  private detectFrameworksByDep(packageJson: Record<string, unknown> | null): FrameworkName[] {
    if (!packageJson) return [];

    const deps = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined),
    };

    const detected: FrameworkName[] = [];
    for (const { framework, packages } of DEP_INDICATORS) {
      if (packages.some(pkg => pkg in deps)) {
        detected.push(framework);
      }
    }
    return detected;
  }
}
