import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator } from './base.js';

export class GeminiGenerator extends BaseGenerator {
  readonly outputKey = 'GEMINI.md' as const;
  readonly outputPath = 'GEMINI.md';

  generate(config: ContextConfig): string {
    const { project, conventions } = config;
    const lines: string[] = [];

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
}
