import type { ContextConfig } from './types.js';

/**
 * Identity function that returns the config unchanged.
 * Exists solely to provide TypeScript type inference and IntelliSense in config files.
 */
export function defineContext(config: ContextConfig): ContextConfig {
  return config;
}
