import { describe, it, expect } from 'vitest';
import { generateProductMd, generateTechMd, generateConventionsMd, KiroGenerator } from './kiro.js';
import type { ContextConfig } from '../types.js';

const baseConfig: ContextConfig = {
  project: {
    name: 'my-app',
    stack: ['TypeScript', 'React', 'Node.js'],
    architecture: 'Monorepo with shared packages',
  },
  conventions: {
    code: [
      { title: 'Naming', items: ['camelCase for variables', 'PascalCase for components'] },
      { title: 'Secret', items: ['internal only'], scope: 'human-only' },
    ],
    testing: [
      { title: 'Unit tests', items: ['Use Vitest', 'Colocate test files'], scope: 'agent-only' },
    ],
  },
  outputs: { '.kiro/steering': true },
};

describe('generateProductMd', () => {
  it('includes frontmatter', () => {
    const out = generateProductMd(baseConfig);
    expect(out).toContain('---\ninclusion: always\n---');
  });

  it('includes project name and architecture', () => {
    const out = generateProductMd(baseConfig);
    expect(out).toContain('# my-app');
    expect(out).toContain('Monorepo with shared packages');
  });
});

describe('generateTechMd', () => {
  it('includes frontmatter', () => {
    expect(generateTechMd(baseConfig)).toContain('---\ninclusion: always\n---');
  });

  it('lists all stack items', () => {
    const out = generateTechMd(baseConfig);
    expect(out).toContain('- TypeScript');
    expect(out).toContain('- React');
    expect(out).toContain('- Node.js');
  });
});

describe('generateConventionsMd', () => {
  it('includes frontmatter', () => {
    expect(generateConventionsMd(baseConfig)).toContain('---\ninclusion: always\n---');
  });

  it('excludes human-only sections', () => {
    const out = generateConventionsMd(baseConfig);
    expect(out).not.toContain('internal only');
    expect(out).not.toContain('Secret');
  });

  it('includes agent-only sections', () => {
    const out = generateConventionsMd(baseConfig);
    expect(out).toContain('Use Vitest');
  });

  it('includes unscoped sections', () => {
    const out = generateConventionsMd(baseConfig);
    expect(out).toContain('camelCase for variables');
  });

  it('skips categories with no visible sections', () => {
    const config: ContextConfig = {
      ...baseConfig,
      conventions: {
        secrets: [{ title: 'Hidden', items: ['nope'], scope: 'human-only' }],
      },
    };
    const out = generateConventionsMd(config);
    expect(out).not.toContain('secrets');
  });
});

describe('KiroGenerator', () => {
  it('has correct outputKey and outputPath', () => {
    const gen = new KiroGenerator();
    expect(gen.outputKey).toBe('.kiro/steering');
    expect(gen.outputPath).toBe('.kiro/steering');
  });

  it('generate() returns combined preview of all three files', () => {
    const gen = new KiroGenerator();
    const out = gen.generate(baseConfig);
    expect(out).toContain('.kiro/steering/product.md');
    expect(out).toContain('.kiro/steering/tech.md');
    expect(out).toContain('.kiro/steering/conventions.md');
  });
});
