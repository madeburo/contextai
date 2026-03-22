import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DiffEngineImpl } from './diff-engine';

const engine = new DiffEngineImpl();

describe('DiffEngine', () => {
  describe('unit tests', () => {
    it('returns hasChanges=false and empty hunks for identical content', () => {
      const content = 'line1\nline2\nline3\n';
      const result = engine.diff(content, content);
      expect(result.hasChanges).toBe(false);
      expect(result.hunks).toHaveLength(0);
    });

    it('marks added lines with + when in-memory has extra lines', () => {
      const inMemory = 'line1\nline2\nnew line\n';
      const onDisk = 'line1\nline2\n';
      const result = engine.diff(inMemory, onDisk);
      expect(result.hasChanges).toBe(true);
      const addedLines = result.hunks.flatMap(h => h.lines).filter(l => l.type === '+');
      expect(addedLines.some(l => l.content === 'new line')).toBe(true);
    });

    it('marks removed lines with - when on-disk has extra lines', () => {
      const inMemory = 'line1\nline2\n';
      const onDisk = 'line1\nline2\nold line\n';
      const result = engine.diff(inMemory, onDisk);
      expect(result.hasChanges).toBe(true);
      const removedLines = result.hunks.flatMap(h => h.lines).filter(l => l.type === '-');
      expect(removedLines.some(l => l.content === 'old line')).toBe(true);
    });

    it('treats missing on-disk file (empty string) as all lines added', () => {
      const inMemory = 'line1\nline2\nline3\n';
      const result = engine.diff(inMemory, '');
      expect(result.hasChanges).toBe(true);
      const allLines = result.hunks.flatMap(h => h.lines);
      expect(allLines.every(l => l.type === '+')).toBe(true);
      expect(allLines.map(l => l.content)).toEqual(['line1', 'line2', 'line3']);
    });

    it('handles both additions and removals in the same diff', () => {
      const inMemory = 'line1\nchanged\nline3\n';
      const onDisk = 'line1\noriginal\nline3\n';
      const result = engine.diff(inMemory, onDisk);
      expect(result.hasChanges).toBe(true);
      const allLines = result.hunks.flatMap(h => h.lines);
      expect(allLines.some(l => l.type === '+' && l.content === 'changed')).toBe(true);
      expect(allLines.some(l => l.type === '-' && l.content === 'original')).toBe(true);
    });

    it('returns hasChanges=false for two empty strings', () => {
      const result = engine.diff('', '');
      expect(result.hasChanges).toBe(false);
      expect(result.hunks).toHaveLength(0);
    });
  });

  describe('property-based tests', () => {
    // Feature: contextai, Property 12: Diff correctly identifies added and removed lines
    // Validates: Requirements 6.2, 6.3
    it('P12: marks additions with + and removals with - for any pair of strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
          fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
          (inMemoryLines, onDiskLines) => {
            const inMemory = inMemoryLines.join('\n');
            const onDisk = onDiskLines.join('\n');
            const result = engine.diff(inMemory, onDisk);

            // All hunk lines must have type + or -
            for (const hunk of result.hunks) {
              for (const line of hunk.lines) {
                expect(line.type === '+' || line.type === '-').toBe(true);
              }
            }

            // hasChanges must be true iff there are hunks
            expect(result.hasChanges).toBe(result.hunks.length > 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: contextai, Property 13: Missing on-disk file treated as all-added diff
    // Validates: Requirements 6.5
    it('P13: when on-disk is empty, all in-memory lines are marked +', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (lines) => {
            const inMemory = lines.join('\n');
            const result = engine.diff(inMemory, '');
            expect(result.hasChanges).toBe(true);
            const allLines = result.hunks.flatMap(h => h.lines);
            expect(allLines.every(l => l.type === '+')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: contextai, Property 11: Diff is non-destructive (no disk writes)
    // Validates: Requirements 6.1
    it('P11: diff is a pure function — same inputs always produce same output', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          fc.string({ maxLength: 200 }),
          (inMemory, onDisk) => {
            const result1 = engine.diff(inMemory, onDisk);
            const result2 = engine.diff(inMemory, onDisk);
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
