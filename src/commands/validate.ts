import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DefaultConfigParser } from '../config-parser.js';
import { DefaultTemplateRegistry } from '../template-registry.js';
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

// Expected section headers per output format
const EXPECTED_HEADERS: Record<OutputKey, string[]> = {
  'AGENTS.md': ['## Stack', '## Architecture', '## Conventions'],
  'CLAUDE.md': ['## Stack', '## Architecture'],
  '.cursorrules': ['PROJECT:', 'STACK:', 'ARCHITECTURE:'],
  '.github/copilot-instructions.md': ['## Stack', '## Architecture', '## Conventions'],
  'llms.txt': ['## Stack', '## Links'],
};

const OUTPUT_KEYS: OutputKey[] = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
  'llms.txt',
];

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

  // Get mtime of context.config.ts for freshness checks
  const configStat = await fs.stat(configPath);
  const configMtime = configStat.mtimeMs;
  let checkedCount = 0;

  for (const key of OUTPUT_KEYS) {
    if (config.outputs[key] !== true) {
      continue;
    }

    checkedCount++;
    const outputPath = key;
    const fullPath = path.join(projectRoot, outputPath);

    // 1. Existence check
    let outputStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
    try {
      outputStat = await fs.stat(fullPath);
    } catch {
      errors.push({
        type: 'missing',
        outputPath,
        message: `Output file "${outputPath}" does not exist. Run "contextai generate" to create it.`,
      });
      continue;
    }

    // 2. Freshness check
    if (outputStat.mtimeMs < configMtime) {
      errors.push({
        type: 'stale',
        outputPath,
        message: `Output file "${outputPath}" is older than config. Run "contextai generate" to update it.`,
      });
    }

    // 3. Header check
    const content = await fs.readFile(fullPath, 'utf-8');
    const expectedHeaders = EXPECTED_HEADERS[key];
    for (const header of expectedHeaders) {
      if (!content.includes(header)) {
        errors.push({
          type: 'missing-header',
          outputPath,
          header,
          message: `Output file "${outputPath}" is missing expected section header "${header}".`,
        });
      }
    }
  }

  if (errors.length === 0) {
    success(`All ${checkedCount} output file${checkedCount === 1 ? '' : 's'} valid.`);
  }

  return { errors, success: errors.length === 0 };
}
