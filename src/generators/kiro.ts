import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator, resolveOutputPath } from './base.js';
import { GeneratorWriteError } from '../errors.js';

const FRONTMATTER = '---\ninclusion: always\n---\n\n';

export function generateProductMd(config: ContextConfig): string {
  const { project } = config;
  const lines: string[] = [FRONTMATTER];
  lines.push(`# ${project.name}`, '');
  lines.push('## Architecture', '');
  lines.push(project.architecture, '');
  return lines.join('\n').trimEnd() + '\n';
}

export function generateTechMd(config: ContextConfig): string {
  const { project } = config;
  const lines: string[] = [FRONTMATTER];
  lines.push('# Technology Stack', '');
  for (const item of project.stack) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  return lines.join('\n').trimEnd() + '\n';
}

export function generateConventionsMd(config: ContextConfig): string {
  const { conventions } = config;
  const lines: string[] = [FRONTMATTER];
  lines.push('# Conventions', '');

  for (const [category, sections] of Object.entries(conventions)) {
    const visible = sections.filter((s: ConventionSection) => s.scope !== 'human-only');
    if (visible.length === 0) continue;

    lines.push(`## ${category}`, '');
    for (const section of visible) {
      lines.push(`### ${section.title}`, '');
      for (const item of section.items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

const STEERING_FILES = [
  { name: 'product.md', fn: generateProductMd },
  { name: 'tech.md', fn: generateTechMd },
  { name: 'conventions.md', fn: generateConventionsMd },
] as const;

export class KiroGenerator extends BaseGenerator {
  readonly outputKey = '.kiro/steering' as const;
  readonly outputPath = '.kiro/steering';

  generate(config: ContextConfig): string {
    return this.generateFiles(config)
      .map(f => `=== ${f.path} ===\n${f.content}`)
      .join('\n');
  }

  generateFiles(config: ContextConfig): Array<{ path: string; content: string }> {
    return STEERING_FILES.map(({ name, fn }) => ({
      path: `.kiro/steering/${name}`,
      content: fn(config),
    }));
  }

  async write(config: ContextConfig, projectRoot: string): Promise<void> {
    const files = this.generateFiles(config);
    try {
      for (const file of files) {
        const fullPath = resolveOutputPath(projectRoot, file.path);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }
    } catch (err) {
      throw new GeneratorWriteError(
        this.outputPath,
        `Failed to write ${this.outputPath}: ${(err as Error).message}`
      );
    }
  }
}
