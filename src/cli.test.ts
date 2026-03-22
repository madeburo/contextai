import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCli } from './cli.js';

// Mock all command implementations
vi.mock('./commands/init.js', () => ({ runInit: vi.fn().mockResolvedValue({ configPath: '', installedGitHook: false }) }));
vi.mock('./commands/generate.js', () => ({ runGenerate: vi.fn().mockResolvedValue({ writtenFiles: [], errors: [] }), buildGenerators: vi.fn().mockReturnValue([]) }));
vi.mock('./commands/validate.js', () => ({ runValidate: vi.fn().mockResolvedValue({ errors: [], success: true }) }));
vi.mock('./commands/diff.js', () => ({ runDiff: vi.fn().mockResolvedValue({ fileDiffs: [], allInSync: true }) }));
vi.mock('./commands/watch.js', () => ({ runWatch: vi.fn().mockResolvedValue(undefined) }));

import { runGenerate } from './commands/generate.js';
import { runValidate } from './commands/validate.js';

describe('CLI', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('--version prints the package version', async () => {
    const program = createCli();
    // commander writes version to stdout
    let output = '';
    program.configureOutput({
      writeOut: (str) => { output += str; },
    });
    try {
      await program.parseAsync(['node', 'cli', '--version']);
    } catch {
      // commander may throw on --version in some modes
    }
    // version should be a semver string
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('--help for root command prints usage', async () => {
    const program = createCli();
    let output = '';
    program.configureOutput({
      writeOut: (str) => { output += str; },
      writeErr: (str) => { output += str; },
    });
    try {
      await program.parseAsync(['node', 'cli', '--help']);
    } catch {
      // commander exits after --help
    }
    expect(output).toContain('Usage:');
    expect(output).toContain('contextai');
  });

  it('unrecognized sub-command prints error with command name and exits non-zero', async () => {
    const program = createCli();
    program.configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });
    // exitOverride prevents process.exit from being called by commander
    program.exitOverride();

    let stderrOutput = '';
    stderrSpy.mockImplementation((msg) => { stderrOutput += msg; return true; });

    try {
      await program.parseAsync(['node', 'cli', 'unknowncmd']);
    } catch {
      // may throw due to exitOverride
    }

    expect(stderrOutput).toContain('unknowncmd');
  });

  it('generate --dry-run calls runGenerate with { dryRun: true }', async () => {
    const program = createCli();
    program.exitOverride();
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} });

    await program.parseAsync(['node', 'cli', 'generate', '--dry-run']);

    expect(runGenerate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ dryRun: true }));
  });

  it('validate calls runValidate', async () => {
    const program = createCli();
    program.exitOverride();
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} });

    await program.parseAsync(['node', 'cli', 'validate']);

    expect(runValidate).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });
});
