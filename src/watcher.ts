import chokidar from 'chokidar';

export interface Watcher {
  start(configPath: string, onChanged: () => Promise<void>): void;
  stop(): void;
}

export class DefaultWatcher implements Watcher {
  private fsWatcher: ReturnType<typeof chokidar.watch> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private sigintHandler: (() => void) | null = null;
  private isRunning = false;

  start(configPath: string, onChanged: () => Promise<void>): void {
    // Clean up any previous session to prevent listener leaks
    this.stop();

    this.fsWatcher = chokidar.watch(configPath, { ignoreInitial: true });

    this.fsWatcher.on('change', () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        // Prevent concurrent regenerations
        if (this.isRunning) return;
        this.isRunning = true;
        onChanged()
          .catch((err: unknown) => {
            process.stderr.write(`Watcher error: ${err instanceof Error ? err.message : String(err)}\n`);
          })
          .finally(() => {
            this.isRunning = false;
          });
      }, 500);
    });

    this.sigintHandler = () => {
      this.stop();
      process.exit(0);
    };
    process.on('SIGINT', this.sigintHandler);
    process.on('SIGTERM', this.sigintHandler);
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fsWatcher) {
      // chokidar.close() returns a Promise but we intentionally fire-and-forget
      // here because stop() must be synchronous (called from SIGINT handler).
      // In practice the watcher releases its resources promptly.
      void this.fsWatcher.close();
      this.fsWatcher = null;
    }
    if (this.sigintHandler) {
      process.removeListener('SIGINT', this.sigintHandler);
      process.removeListener('SIGTERM', this.sigintHandler);
      this.sigintHandler = null;
    }
    this.isRunning = false;
  }
}
