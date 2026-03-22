import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DefaultConfigParser } from '../config-parser.js';
import { DefaultTemplateRegistry } from '../template-registry.js';
import { buildGenerators } from './generate.js';
import { info, success, verbose, error as logError, fmt } from '../logger.js';
import type { OutputKey } from '../types.js';

export interface ValidateError {
  type: 'missing' | 'stale' | 'missing-header';
  outputPath: string;
  header?: string;
  message: string;
}

export interface ValidateResult {
  errors: ValidateError[];
  success: boolean;
}

export interface ValidateOptions {
  configPath?: string;
}

// Expected section headers per output file path
const EXPECTED_HEADERS: Record<string, string[]> = {
  'AGENTS.md': ['## Stack', '## Architecture', '## Conventions'],
  'CLAUDE.md': ['## Stack', '## Architecture'],
  '.cursorrules': ['PROJECT:', 'STACK:', 'ARCHITECTURE:'],
  '.github/copilot-instructions.md': ['## Stack', '## Architecture', '## Conventions'],
  'llms.txt': ['## Stack', '## Links'],
  '.kiro/steering/product.md': ['inclusion: always', '## Architecture'],
  '.kiro/steering/tech.md': ['inclusion: always', '# Technology Stack'],
  '.kiro/steering/conventions.md': ['inclusion: always', '# Conventions'],
};

export async function runValidate(projectRoot: string, options?: ValidateOptions): Promise<ValidateResult> {
  const errors: ValidateError[] = [];

  const configFile = options?.configPath ?? 'context.config.ts';
  const configPath = path.isAbsolute(configFile) ? configFile : path.join(projectRoot, configFile);
  const parser = new DefaultConfigParser();
  const registry = new DefaultTemplateRegistry();

  verbose(`Loading config from ${configPath}`);
  let config = await parser.load(configPath);

  if (config.templates && config.templates.length > 0) {
    config = registry.merge(config, config.templates);
  }

  const generators = buildGenerators(config);

  // Get mtime of context.config.ts for freshness checks
  const configStat = await fs.stat(configPath);
  const configMtime = configStat.mtimeMs;
  let checkedCount = 0;

  for (const gen of generators) {
    const files = gen.generateFiles(config);

    for (const file of files) {
      checkedCount++;
      const fullPath = path.join(projectRoot, file.path);

      // 1. Existence check
      let outputStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        outputStat = await fs.stat(fullPath);
      } catch {
        errors.push({
          type: 'missing',
          outputPath: file.path,
          message: `Output file "${file.path}" does not exist. Run "contextai generate" to create it.`,
        });
        continue;
      }

      // 2. Freshness check
      if (outputStat.mtimeMs < configMtime) {
        errors.push({
          type: 'stale',
          outputPath: file.path,
          message: `Output file "${file.path}" is older than config. Run "contextai generate" to update it.`,
        });
      }

      // 3. Header check
      const expectedHeaders = EXPECTED_HEADERS[file.path];
      if (expectedHeaders) {
        const content = await fs.readFile(fullPath, 'utf-8');
        for (const header of expectedHeaders) {
          if (!content.includes(header)) {
            errors.push({
              type: 'missing-header',
              outputPath: file.path,
              header,
              message: `Output file "${file.path}" is missing expected section header "${header}".`,
            });
          }
        }
      }
    }
  }

  if (errors.length === 0) {
    success(`All ${checkedCount} output file${checkedCount === 1 ? '' : 's'} valid.`);
  }

  return { errors, success: errors.length === 0 };
}
