import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { defineContext } from './defineContext.js';
import type { ContextConfig, ConventionSection, OutputsConfig } from './types.js';

// Arbitraries for ContextConfig
const conventionSectionArb: fc.Arbitrary<ConventionSection> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  items: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
  scope: fc.option(fc.constantFrom('agent-only' as const, 'human-only' as const), { nil: undefined }),
});

const outputsConfigArb: fc.Arbitrary<OutputsConfig> = fc.record({
  'AGENTS.md': fc.option(fc.boolean(), { nil: undefined }),
  'CLAUDE.md': fc.option(fc.boolean(), { nil: undefined }),
  '.cursorrules': fc.option(fc.boolean(), { nil: undefined }),
  '.github/copilot-instructions.md': fc.option(fc.boolean(), { nil: undefined }),
  'llms.txt': fc.option(fc.boolean(), { nil: undefined }),
});

const contextConfigArb: fc.Arbitrary<ContextConfig> = fc.record({
  project: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    stack: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
    architecture: fc.string({ minLength: 1, maxLength: 200 }),
  }),
  conventions: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.array(conventionSectionArb, { minLength: 1, maxLength: 5 }),
    { minKeys: 0, maxKeys: 5 }
  ),
  outputs: outputsConfigArb,
  templates: fc.option(
    fc.array(fc.constantFrom('nextjs' as const, 'nestjs' as const, 'express' as const, 'remix' as const, 'sveltekit' as const), { maxLength: 5 }),
    { nil: undefined }
  ),
});

// Feature: contextai, Property 1: defineContext is an identity function
describe('defineContext', () => {
  it('P1: returns the exact same object reference', () => {
    // Validates: Requirements 1.1
    fc.assert(
      fc.property(contextConfigArb, (config) => {
        const result = defineContext(config);
        expect(result).toBe(config);
      }),
      { numRuns: 100 }
    );
  });

  it('P1: returned value is deeply equal to input', () => {
    // Validates: Requirements 1.1
    fc.assert(
      fc.property(contextConfigArb, (config) => {
        const result = defineContext(config);
        expect(result).toEqual(config);
      }),
      { numRuns: 100 }
    );
  });
});
