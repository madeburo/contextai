import { describe, it, expect } from 'vitest';
import { generateWindsurfRules, WindsurfGenerator } from './windsurf.js';
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
  outputs: { '.windsurf/rules': true },
};

describe('generateWindsurfRules', () => {
  it('includes YAML frontmatter with trigger: always_on', () => {
    const out = generateWindsurfRules(baseConfig);
    expect(out).toContain('---\ntrigger: always_on\n---');
  });

  it('includes project name and stack', () => {
    const out = generateWindsurfRules(baseConfig);
    expect(out).toContain('# my-app');
    expect(out).toContain('- TypeScript');
    expect(out).toContain('- React');
  });

  it('includes architecture', () => {
    const out = generateWindsurfRules(baseConfig);
    expect(out).toContain('Monorepo with shared packages');
  });

  it('excludes human-only sections', () => {
    const out = generateWindsurfRules(baseConfig);
    expect(out).not.toContain('internal only');
    expect(out).not.toContain('Secret');
  });

  it('includes agent-only and unscoped sections', () => {
    const out = generateWindsurfRules(baseConfig);
    expect(out).toContain('Use Vitest');
    expect(out).toContain('camelCase for variables');
  });
});

describe('WindsurfGenerator', () => {
  it('has correct outputKey and outputPath', () => {
    const gen = new WindsurfGenerator();
    expect(gen.outputKey).toBe('.windsurf/rules');
    expect(gen.outputPath).toBe('.windsurf/rules');
  });

  it('generateFiles returns .windsurf/rules/project-context.md', () => {
    const gen = new WindsurfGenerator();
    const files = gen.generateFiles(baseConfig);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('.windsurf/rules/project-context.md');
    expect(files[0].content).toContain('trigger: always_on');
  });

  it('generate() returns combined preview', () => {
    const gen = new WindsurfGenerator();
    const out = gen.generate(baseConfig);
    expect(out).toContain('.windsurf/rules/project-context.md');
  });
});
