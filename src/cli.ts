#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { runValidate } from './commands/validate.js';
import { runDiff } from './commands/diff.js';
import { runWatch } from './commands/watch.js';
import { setVerbosity, error as logError } from './logger.js';
import type { Verbosity } from './logger.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function applyVerbosity(opts: { quiet?: boolean; verbose?: boolean }): void {
  let v: Verbosity = 'normal';
  if (opts.quiet) v = 'quiet';
  else if (opts.verbose) v = 'verbose';
  setVerbosity(v);
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('contextai')
    .description('Universal context engineering CLI for AI coding agents — https://www.contextai.run')
    .version(pkg.version, '-v, --version');

  program
    .command('init')
    .description('Initialize context.config.ts interactively')
    .action(async () => {
      try {
        await runInit(process.cwd());
      } catch (err) {
        logError(formatError(err));
        process.exit(1);
      }
    });

  program
    .command('generate')
    .description('Generate AI context files from config')
    .option('--dry-run', 'Preview output without writing files')
    .option('-c, --config <path>', 'Path to config file', 'context.config.ts')
    .option('--only <targets>', 'Generate only specific targets (comma-separated)')
    .option('--format <format>', 'Output format: text (default) or json (JSON IR to stdout)')
    .option('-q, --quiet', 'Suppress all output except errors')
    .option('--verbose', 'Show detailed output')
    .action(async (opts: { dryRun?: boolean; config?: string; only?: string; format?: string; quiet?: boolean; verbose?: boolean }) => {
      try {
        applyVerbosity(opts);
        const only = opts.only ? opts.only.split(',').map(s => s.trim()) : undefined;
        const format = opts.format === 'json' ? 'json' as const : 'text' as const;
        const result = await runGenerate(process.cwd(), {
          dryRun: opts.dryRun,
          configPath: opts.config,
          only,
          format,
        });
        if (result.errors.length > 0) {
          process.exit(1);
        }
      } catch (err) {
        logError(formatError(err));
        process.exit(1);
      }
    });

  program
    .command('validate')
    .description('Validate that output files are fresh and well-structured')
    .option('-c, --config <path>', 'Path to config file', 'context.config.ts')
    .option('-q, --quiet', 'Suppress all output except errors')
    .option('--verbose', 'Show detailed output')
    .action(async (opts: { config?: string; quiet?: boolean; verbose?: boolean }) => {
      try {
        applyVerbosity(opts);
        const result = await runValidate(process.cwd(), { configPath: opts.config });
        if (!result.success) {
          for (const e of result.errors) {
            logError(e.message);
          }
          process.exit(1);
        }
      } catch (err) {
        logError(formatError(err));
        process.exit(1);
      }
    });

  program
    .command('diff')
    .description('Show diff between config and on-disk output files')
    .option('-c, --config <path>', 'Path to config file', 'context.config.ts')
    .option('-q, --quiet', 'Suppress all output except errors')
    .option('--verbose', 'Show detailed output')
    .action(async (opts: { config?: string; quiet?: boolean; verbose?: boolean }) => {
      try {
        applyVerbosity(opts);
        await runDiff(process.cwd(), { configPath: opts.config });
      } catch (err) {
        logError(formatError(err));
        process.exit(1);
      }
    });

  program
    .command('watch')
    .description('Watch config for changes and regenerate automatically')
    .option('-c, --config <path>', 'Path to config file', 'context.config.ts')
    .option('--verbose', 'Show detailed output')
    .action(async (opts: { config?: string; verbose?: boolean }) => {
      try {
        if (opts.verbose) setVerbosity('verbose');
        await runWatch(process.cwd(), { configPath: opts.config });
      } catch (err) {
        logError(formatError(err));
        process.exit(1);
      }
    });

  // Handle unrecognized sub-commands
  program.on('command:*', (operands: string[]) => {
    logError(`unknown command '${operands[0]}'`);
    program.help({ error: true });
  });

  return program;
}

// Run when executed directly
if (require.main === module) {
  const program = createCli();
  program.parseAsync(process.argv).catch((err: unknown) => {
    logError(formatError(err));
    process.exit(1);
  });
}
