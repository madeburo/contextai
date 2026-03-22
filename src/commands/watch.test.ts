import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWatch } from './watch.js';
import { ConfigParseError } from '../errors.js';
import { DefaultWatcher, type Watcher } from '../watcher.js';

// ---------------------------------------------------------------------------
// FakeWatcher — lets tests trigger changes manually
// ---------------------------------------------------------------------------

class FakeWatcher implements Watcher {
  private callback: (() => Promise<void>) | null = null;
  public stopped = false;

  start(_configPath: string, onChanged: () => Promise<void>): void {
    this.callback = onChanged;
  }

  stop(): void {
    this.stopped = true;
    this.callback = null;
  }

  async triggerChange(): Promise<void> {
    if (this.callback) await this.callback();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(tmpdir(), `contextai-watch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeValidConfig(dir: string): void {
  writeFileSync(
    join(dir, 'context.config.ts'),
    `export default {
  project: { name: 'WatchApp', stack: ['Node.js'], architecture: 'monolith' },
  conventions: { code: [{ title: 'Style', items: ['Use ESLint'] }] },
  outputs: { 'AGENTS.md': true },
};\n`
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('watch command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('file change triggers regeneration', async () => {
    writeValidConfig(tmpDir);

    const fakeWatcher = new FakeWatcher();

    // Spy on runGenerate by mocking the module
    const generateModule = await import('./generate.js');
    const generateSpy = vi.spyOn(generateModule, 'runGenerate').mockResolvedValue({
      writtenFiles: ['AGENTS.md'],
      errors: [],
    });

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runWatch(tmpDir, { watcher: fakeWatcher });

    // Trigger a change
    await fakeWatcher.triggerChange();

    expect(generateSpy).toHaveBeenCalledWith(tmpDir, expect.any(Object));
  });

  it('config parse error after change logs to stderr and watcher continues', async () => {
    writeValidConfig(tmpDir);

    const fakeWatcher = new FakeWatcher();

    const generateModule = await import('./generate.js');
    vi.spyOn(generateModule, 'runGenerate').mockRejectedValue(
      new ConfigParseError(join(tmpDir, 'context.config.ts'), 1, 'Unexpected token')
    );

    const stderrChunks: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runWatch(tmpDir, { watcher: fakeWatcher });

    // Trigger a change — should not throw
    await expect(fakeWatcher.triggerChange()).resolves.toBeUndefined();

    const stderrOutput = stderrChunks.join('');
    expect(stderrOutput).toContain('Config parse error');
    expect(stderrOutput).toContain('Unexpected token');
  });

  it('SIGINT stops DefaultWatcher and exits with code 0', async () => {
    // Test the SIGINT behaviour without a real chokidar watcher.
    // We record what the SIGINT handler does by capturing calls on a
    // thin wrapper that never touches the file system.
    let sigintHandler: (() => void) | null = null;
    const originalOn = process.on.bind(process);
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'SIGINT') {
        sigintHandler = listener as () => void;
        return process;
      }
      return originalOn(event, listener);
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error('process.exit called');
    });

    const watcher = new DefaultWatcher();
    const stopSpy = vi.spyOn(watcher, 'stop').mockImplementation(() => {
      // no-op — avoid touching real chokidar
    });

    // start() will call chokidar.watch, but we only care about the SIGINT
    // registration, so mock the fs watcher field away immediately after
    watcher.start(join(tmpDir, 'context.config.ts'), async () => {});
    // Immediately neutralise the real chokidar watcher so it can't hold the event loop
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realFsWatcher = (watcher as any).fsWatcher;
    if (realFsWatcher) {
      await realFsWatcher.close();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (watcher as any).fsWatcher = null;
    }

    expect(sigintHandler).not.toBeNull();

    let threw = false;
    try {
      sigintHandler!();
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
    expect(stopSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    processOnSpy.mockRestore();
  });
});
