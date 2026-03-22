import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DefaultConfigParser } from '../config-parser.js';
import { DefaultTemplateRegistry } from '../template-registry.js';
import { DiffEngineImpl } from '../diff-engine.js';
import { buildGenerators } from './generate.js';
import { info, verbose, fmt } from '../logger.js';
import type { DiffResult } from '../types.js';

export interface FileDiff {
  outputPath: string;
  result: DiffResult;
}

export interface DiffCommandResult {
  fileDiffs: FileDiff[];
  allInSync: boolean;
}

export interface DiffOptions {
  configPath?: string;
}

export async function runDiff(projectRoot: string, options?: DiffOptions): Promise<DiffCommandResult> {
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
  const engine = new DiffEngineImpl();
  const fileDiffs: FileDiff[] = [];

  for (const gen of generators) {
    const inMemory = gen.generate(config);
    const fullPath = path.join(projectRoot, gen.outputPath);

    let onDisk = '';
    try {
      onDisk = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // Missing file treated as empty string — all lines will be additions
    }

    const result = engine.diff(inMemory, onDisk);
    fileDiffs.push({ outputPath: gen.outputPath, result });
  }

  const allInSync = fileDiffs.every((fd) => !fd.result.hasChanges);

  if (allInSync) {
    info(fmt.green('All files are in sync.'));
  } else {
    for (const fd of fileDiffs) {
      if (!fd.result.hasChanges) {
        info(`${fmt.green('✓')} ${fd.outputPath} ${fmt.dim('(in sync)')}`);
        continue;
      }
      info(`${fmt.yellow('~')} ${fd.outputPath}`);
      for (const hunk of fd.result.hunks) {
        for (const line of hunk.lines) {
          if (line.type === '+') {
            process.stdout.write(fmt.green(`+ ${line.content}`) + '\n');
          } else {
            process.stdout.write(fmt.red(`- ${line.content}`) + '\n');
          }
        }
      }
    }
  }

  return { fileDiffs, allInSync };
}
