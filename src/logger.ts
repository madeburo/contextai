/**
 * Minimal logger with color support for CLI output.
 * Colors are auto-disabled when stdout is not a TTY (e.g. CI, piped output).
 */

const isColorSupported = process.stdout.isTTY ?? false;

function color(code: number, text: string): string {
  if (!isColorSupported) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export const fmt = {
  green: (text: string) => color(32, text),
  red: (text: string) => color(31, text),
  yellow: (text: string) => color(33, text),
  cyan: (text: string) => color(36, text),
  dim: (text: string) => color(2, text),
  bold: (text: string) => color(1, text),
};

export type Verbosity = 'quiet' | 'normal' | 'verbose';

let currentVerbosity: Verbosity = 'normal';

export function setVerbosity(v: Verbosity): void {
  currentVerbosity = v;
}

export function getVerbosity(): Verbosity {
  return currentVerbosity;
}

/** Print to stdout (suppressed in quiet mode). */
export function info(message: string): void {
  if (currentVerbosity === 'quiet') return;
  process.stdout.write(message + '\n');
}

/** Print to stdout only in verbose mode. */
export function verbose(message: string): void {
  if (currentVerbosity !== 'verbose') return;
  process.stdout.write(fmt.dim(message) + '\n');
}

/** Print to stderr (always shown, even in quiet mode). */
export function error(message: string): void {
  process.stderr.write(fmt.red('error') + ': ' + message + '\n');
}

/** Print a success line: ✓ message */
export function success(message: string): void {
  if (currentVerbosity === 'quiet') return;
  process.stdout.write(fmt.green('✓') + ' ' + message + '\n');
}

/** Print a warning line: ⚠ message */
export function warn(message: string): void {
  if (currentVerbosity === 'quiet') return;
  process.stderr.write(fmt.yellow('⚠') + ' ' + message + '\n');
}
