import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DefaultTemplateRegistry } from './template-registry.js';
import { UnknownTemplateError } from './errors.js';
import type { ContextConfig, ConventionSection, OutputsConfig, TemplateName } from './types.js';

// Arbitraries
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

const templateNameArb: fc.Arbitrary<TemplateName> = fc.constantFrom(
  'nextjs' as const,
  'nestjs' as const,
  'express' as const,
  'remix' as const,
  'sveltekit' as const
);

const KNOWN_TEMPLATE_NAMES = new Set(['nextjs', 'nestjs', 'express', 'remix', 'sveltekit']);

// Unknown template name: any string that is not a known template name
const unknownTemplateNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => !KNOWN_TEMPLATE_NAMES.has(s)
);

const registry = new DefaultTemplateRegistry();

// Feature: contextai, Property 14: Template merge preserves existing conventions
describe('TemplateRegistry - Property 14: merge preserves existing conventions', () => {
  it('P14: existing convention keys and sections are preserved after merge', () => {
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(contextConfigArb, templateNameArb, (config, templateName) => {
        const originalConventionKeys = Object.keys(config.conventions);
        const originalSectionsByKey: Record<string, ConventionSection[]> = {};
        for (const key of originalConventionKeys) {
          originalSectionsByKey[key] = [...config.conventions[key]!];
        }

        const merged = registry.merge(config, [templateName]);

        // All original keys must still be present
        for (const key of originalConventionKeys) {
          expect(merged.conventions[key]).toBeDefined();
        }

        // All original sections must still be present (at the start of each key's array)
        for (const key of originalConventionKeys) {
          const originalSections = originalSectionsByKey[key]!;
          const mergedSections = merged.conventions[key]!;
          // Original sections appear at the beginning
          for (let i = 0; i < originalSections.length; i++) {
            expect(mergedSections[i]).toEqual(originalSections[i]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('P14: merge does not mutate the base config', () => {
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(contextConfigArb, templateNameArb, (config, templateName) => {
        const originalConventionsSnapshot = JSON.parse(JSON.stringify(config.conventions));
        registry.merge(config, [templateName]);
        expect(config.conventions).toEqual(originalConventionsSnapshot);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: contextai, Property 15: Unknown template names produce errors
describe('TemplateRegistry - Property 15: unknown template names produce errors', () => {
  it('P15: get() throws UnknownTemplateError for unrecognized names', () => {
    // Validates: Requirements 8.4
    fc.assert(
      fc.property(unknownTemplateNameArb, (unknownName) => {
        expect(() => registry.get(unknownName as TemplateName)).toThrow(UnknownTemplateError);
      }),
      { numRuns: 100 }
    );
  });

  it('P15: UnknownTemplateError message includes the unrecognized name', () => {
    // Validates: Requirements 8.4
    fc.assert(
      fc.property(unknownTemplateNameArb, (unknownName) => {
        try {
          registry.get(unknownName as TemplateName);
          expect.fail('Expected UnknownTemplateError to be thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(UnknownTemplateError);
          expect((err as UnknownTemplateError).message).toContain(unknownName);
          expect((err as UnknownTemplateError).templateName).toBe(unknownName);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('P15: merge() throws UnknownTemplateError when any template name is unrecognized', () => {
    // Validates: Requirements 8.4
    fc.assert(
      fc.property(contextConfigArb, unknownTemplateNameArb, (config, unknownName) => {
        expect(() => registry.merge(config, [unknownName as TemplateName])).toThrow(UnknownTemplateError);
      }),
      { numRuns: 100 }
    );
  });
});

// Unit tests for TemplateRegistry
describe('TemplateRegistry - unit tests', () => {
  it('list() returns all five built-in template names', () => {
    const names = registry.list();
    expect(names).toHaveLength(5);
    expect(names).toContain('nextjs');
    expect(names).toContain('nestjs');
    expect(names).toContain('express');
    expect(names).toContain('remix');
    expect(names).toContain('sveltekit');
  });

  it('get() returns a template with conventions for each built-in name', () => {
    for (const name of registry.list()) {
      const template = registry.get(name);
      expect(template).toBeDefined();
      expect(template.name).toBe(name);
      expect(template.conventions).toBeDefined();
      expect(typeof template.conventions).toBe('object');
    }
  });

  it('merge() appends template conventions to new keys', () => {
    const base: ContextConfig = {
      project: { name: 'test', stack: ['node'], architecture: 'monolith' },
      conventions: {},
      outputs: {},
    };
    const merged = registry.merge(base, ['nextjs']);
    // nextjs template has 'code' and 'testing' keys
    expect(merged.conventions['code']).toBeDefined();
    expect(merged.conventions['testing']).toBeDefined();
  });

  it('merge() appends to existing keys without overwriting', () => {
    const existingSection: ConventionSection = {
      title: 'My existing rule',
      items: ['do not delete me'],
    };
    const base: ContextConfig = {
      project: { name: 'test', stack: ['node'], architecture: 'monolith' },
      conventions: {
        code: [existingSection],
      },
      outputs: {},
    };
    const merged = registry.merge(base, ['nextjs']);
    // The existing section must still be first
    expect(merged.conventions['code']![0]).toEqual(existingSection);
    // Template sections are appended after
    expect(merged.conventions['code']!.length).toBeGreaterThan(1);
  });

  it('merge() with empty templateNames returns equivalent config', () => {
    const base: ContextConfig = {
      project: { name: 'test', stack: ['node'], architecture: 'monolith' },
      conventions: { code: [{ title: 'rule', items: ['item'] }] },
      outputs: {},
    };
    const merged = registry.merge(base, []);
    expect(merged.conventions).toEqual(base.conventions);
    expect(merged.project).toEqual(base.project);
  });

  it('get() throws UnknownTemplateError for unknown name', () => {
    expect(() => registry.get('angular' as TemplateName)).toThrow(UnknownTemplateError);
    expect(() => registry.get('angular' as TemplateName)).toThrow('Unknown template: "angular"');
  });
});
