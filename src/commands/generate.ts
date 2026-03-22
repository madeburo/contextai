import * as path from 'node:path';
import { DefaultConfigParser } from '../config-parser.js';
import { DefaultTemplateRegistry } from '../template-registry.js';
import { AgentsGenerator } from '../generators/agents.js';
import { ClaudeGenerator } from '../generators/claude.js';
import { CursorGenerator } from '../generators/cursor.js';
import { CopilotGenerator } from '../generators/copilot.js';
import { LlmsTxtGenerator } from '../generators/llms-txt.js';
import { GeneratorWriteError } from '../errors.js';
import { BaseGenerator } from '../generators/base.js';
import { info, success, verbose, error as logError, fmt } from '../logger.js';
import type { ContextConfig } from '../types.js';
import type { Generator } from '../generators/base.js';

export interface GenerateOptions {
  dryRun?: boolean;
  configPath?: string;
  only?: string[];
}

export interface GenerateResult {
  writtenFiles: string[];
  errors: Array<{ outputPath: string; message: string }>;
}

// Custom generator adapter — extends BaseGenerator to reuse write() with path traversal protection
class CustomGenerator extends BaseGenerator {
  readonly outputKey = 'AGENTS.md' as const; // unused for custom generators
  readonly outputPath: string;
  private readonly fn: (config: ContextConfig) => string;

  constructor(outputPath: string, fn: (config: ContextConfig) => string) {
    super();
    this.outputPath = outputPath;
    this.fn = fn;
  }

  generate(config: ContextConfig): string {
    return this.fn(config);
  }
}

/**
 * Build the list of generators to run for a given config.
 * Includes all enabled built-in generators and all custom generators.
 * If `only` is provided, filters to only those output paths.
 */
export function buildGenerators(config: ContextConfig, only?: string[]): Generator[] {
  const { outputs } = config;
  const generators: Generator[] = [];

  const builtIns: Generator[] = [
    new AgentsGenerator(),
    new ClaudeGenerator(),
    new CursorGenerator(),
    new CopilotGenerator(),
    new LlmsTxtGenerator(),
  ];

  for (const gen of builtIns) {
    if (outputs[gen.outputKey as keyof typeof outputs] === true) {
      generators.push(gen);
    }
  }

  if (outputs.custom) {
    for (const custom of outputs.custom) {
      generators.push(new CustomGenerator(custom.path, custom.generator));
    }
  }

  // Filter by --only if provided
  if (only && only.length > 0) {
    return generators.filter(gen => only.includes(gen.outputPath));
  }

  return generators;
}

/**
 * Run the generate command.
 * Loads config, applies templates, then runs all enabled generators.
 */
export async function runGenerate(
  projectRoot: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const { dryRun = false, only } = options;

  const configFile = options.configPath ?? 'context.config.ts';
  const configPath = path.isAbsolute(configFile) ? configFile : path.join(projectRoot, configFile);
  const parser = new DefaultConfigParser();
  const registry = new DefaultTemplateRegistry();

  verbose(`Loading config from ${configPath}`);
  let config = await parser.load(configPath);

  // Apply templates if specified
  if (config.templates && config.templates.length > 0) {
    verbose(`Applying templates: ${config.templates.join(', ')}`);
    config = registry.merge(config, config.templates);
  }

  const generators = buildGenerators(config, only);

  if (generators.length === 0) {
    info('No generators to run.');
    return { writtenFiles: [], errors: [] };
  }

  const writtenFiles: string[] = [];
  const errors: Array<{ outputPath: string; message: string }> = [];

  if (dryRun) {
    info(fmt.dim('--- dry run ---'));
    for (const gen of generators) {
      const content = gen.generate(config);
      process.stdout.write(`\n${fmt.cyan(gen.outputPath)}:\n`);
      process.stdout.write(content);
    }
    info(fmt.dim('\nNo files written (dry run).'));
    return { writtenFiles: [], errors: [] };
  }

  for (const gen of generators) {
    try {
      await gen.write(config, projectRoot);
      writtenFiles.push(gen.outputPath);
      success(gen.outputPath);
    } catch (err) {
      const outputPath = err instanceof GeneratorWriteError ? err.outputPath : gen.outputPath;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ outputPath, message });
      logError(`${outputPath}: ${message}`);
    }
  }

  if (writtenFiles.length > 0) {
    info(fmt.dim(`\nGenerated ${writtenFiles.length} file${writtenFiles.length === 1 ? '' : 's'}.`));
  }

  return { writtenFiles, errors };
}
