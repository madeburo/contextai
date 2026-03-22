import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ContextConfig, OutputKey } from '../types.js';
import { GeneratorWriteError, PathTraversalError, BlacklistedPathError } from '../errors.js';

export interface Generator {
  readonly outputKey: OutputKey;
  readonly outputPath: string;
  generate(config: ContextConfig): string;
  write(config: ContextConfig, projectRoot: string): Promise<void>;
}

/** Directory prefixes that must never be written to by generators. */
const BLACKLISTED_PREFIXES = ['.git'];

/**
 * Resolve outputPath within projectRoot and ensure it doesn't escape via traversal
 * or target protected directories like .git.
 * Throws PathTraversalError if the resolved path is outside projectRoot.
 * Throws BlacklistedPathError if the path targets a protected directory.
 */
export function resolveOutputPath(projectRoot: string, outputPath: string): string {
  const resolvedRoot = path.resolve(projectRoot);
  const fullPath = path.resolve(resolvedRoot, outputPath);
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new PathTraversalError(outputPath, fullPath);
  }

  // Check against blacklisted directory prefixes
  const relative = path.relative(resolvedRoot, fullPath);
  for (const prefix of BLACKLISTED_PREFIXES) {
    if (relative === prefix || relative.startsWith(prefix + path.sep)) {
      throw new BlacklistedPathError(outputPath, `${prefix}/**`);
    }
  }

  return fullPath;
}

export abstract class BaseGenerator implements Generator {
  abstract readonly outputKey: OutputKey;
  abstract readonly outputPath: string;
  abstract generate(config: ContextConfig): string;

  async write(config: ContextConfig, projectRoot: string): Promise<void> {
    const content = this.generate(config);
    const fullPath = resolveOutputPath(projectRoot, this.outputPath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (err) {
      throw new GeneratorWriteError(
        this.outputPath,
        `Failed to write ${this.outputPath}: ${(err as Error).message}`
      );
    }
  }
}
