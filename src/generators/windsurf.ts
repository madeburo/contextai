import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator, resolveOutputPath } from './base.js';
import { GeneratorWriteError } from '../errors.js';

const FRONTMATTER = `---
trigger: always_on
---

`;

export function generateWindsurfRules(config: ContextConfig): string {
  const { project, conventions } = config;
  const lines: string[] = [FRONTMATTER];

  lines.push(`# ${project.name}`, '');
  lines.push('## Stack', '');
  for (const item of project.stack) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Architecture', '');
  lines.push(project.architecture, '');
  lines.push('## Conventions', '');

  for (const sections of Object.values(conventions)) {
    const visible = sections.filter((s: ConventionSection) => s.scope !== 'human-only');
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

export class WindsurfGenerator extends BaseGenerator {
  readonly outputKey = '.windsurf/rules' as const;
  readonly outputPath = '.windsurf/rules';

  generate(config: ContextConfig): string {
    return this.generateFiles(config)
      .map(f => `=== ${f.path} ===\n${f.content}`)
      .join('\n');
  }

  generateFiles(config: ContextConfig): Array<{ path: string; content: string }> {
    return [{ path: '.windsurf/rules/project-context.md', content: generateWindsurfRules(config) }];
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
