import { describe, it, expect } from 'vitest';
import { GeminiGenerator } from './gemini.js';
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
  outputs: { 'GEMINI.md': true },
};

describe('GeminiGenerator', () => {
  it('has correct outputKey and outputPath', () => {
    const gen = new GeminiGenerator();
    expect(gen.outputKey).toBe('GEMINI.md');
    expect(gen.outputPath).toBe('GEMINI.md');
  });

  it('generates plain markdown without frontmatter', () => {
    const gen = new GeminiGenerator();
    const out = gen.generate(baseConfig);
    expect(out).not.toContain('---');
    expect(out).toContain('# my-app');
  });

  it('includes stack items', () => {
    const gen = new GeminiGenerator();
    const out = gen.generate(baseConfig);
    expect(out).toContain('- TypeScript');
    expect(out).toContain('- React');
    expect(out).toContain('- Node.js');
  });

  it('includes architecture', () => {
    const gen = new GeminiGenerator();
    const out = gen.generate(baseConfig);
    expect(out).toContain('Monorepo with shared packages');
  });

  it('excludes human-only sections', () => {
    const gen = new GeminiGenerator();
    const out = gen.generate(baseConfig);
    expect(out).not.toContain('internal only');
    expect(out).not.toContain('Secret');
  });

  it('includes agent-only and unscoped sections', () => {
    const gen = new GeminiGenerator();
    const out = gen.generate(baseConfig);
    expect(out).toContain('Use Vitest');
    expect(out).toContain('camelCase for variables');
  });
});
