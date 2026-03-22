import { diffLines } from 'diff';
import type { DiffEngine, DiffResult, DiffHunk } from './types.js';

export class DiffEngineImpl implements DiffEngine {
  diff(inMemory: string, onDisk: string): DiffResult {
    const changes = diffLines(onDisk, inMemory);

    const hunks: DiffHunk[] = [];
    let hasChanges = false;

    for (const change of changes) {
      if (!change.added && !change.removed) {
        continue;
      }

      hasChanges = true;
      const type = change.added ? '+' : '-';
      const rawLines = change.value.split('\n');
      // diffLines includes a trailing empty string when value ends with '\n'
      const lines = rawLines[rawLines.length - 1] === ''
        ? rawLines.slice(0, -1)
        : rawLines;

      if (lines.length > 0) {
        hunks.push({
          lines: lines.map(content => ({ type, content })),
        });
      }
    }

    return { hasChanges, hunks };
  }
}
