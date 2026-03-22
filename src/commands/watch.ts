import * as path from 'node:path';
import { runGenerate } from './generate.js';
import { ConfigParseError } from '../errors.js';
import { DefaultWatcher, type Watcher } from '../watcher.js';
import { info, success, error as logError, verbose, fmt } from '../logger.js';

export interface WatchOptions {
  /** Injectable watcher for testing */
  watcher?: Watcher;
  configPath?: string;
}

export async function runWatch(projectRoot: string, options?: WatchOptions): Promise<void> {
  const watcher = options?.watcher ?? new DefaultWatcher();
  const configFile = options?.configPath ?? 'context.config.ts';
  const configPath = path.isAbsolute(configFile) ? configFile : path.join(projectRoot, configFile);

  // Initial generation on start
  info('Running initial generation...');
  try {
    const result = await runGenerate(projectRoot, { configPath: options?.configPath });
    if (result.writtenFiles.length > 0) {
      verbose(`Initial generation: ${result.writtenFiles.join(', ')}`);
    }
  } catch (err) {
    if (err instanceof ConfigParseError) {
      logError(`Config parse error: ${err.message}`);
    } else {
      logError(`Initial generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Continue to watch mode even if initial generation fails
  }

  info(`\nWatching ${fmt.cyan(configPath)} for changes... ${fmt.dim('(Ctrl+C to stop)')}`);

  watcher.start(configPath, async () => {
    try {
      const result = await runGenerate(projectRoot, { configPath: options?.configPath });
      const timestamp = new Date().toLocaleTimeString();
      const files = result.writtenFiles.join(', ');
      success(`[${timestamp}] Regenerated: ${files}`);
    } catch (err) {
      if (err instanceof ConfigParseError) {
        logError(`Config parse error: ${err.message}`);
      } else {
        logError(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Continue watching — do not rethrow
    }
  });
}
