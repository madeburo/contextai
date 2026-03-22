import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator } from './base.js';

export class CursorGenerator extends BaseGenerator {
  readonly outputKey = '.cursorrules' as const;
  readonly outputPath = '.cursorrules';

  generate(config: ContextConfig): string {
    const { project, conventions } = config;
    const lines: string[] = [];

    lines.push(`PROJECT: ${project.name}`);
    lines.push(`STACK: ${project.stack.join(', ')}`);
    lines.push(`ARCHITECTURE: ${project.architecture}`);

    for (const sections of Object.values(conventions)) {
      const visible = sections.filter((s: ConventionSection) => s.scope !== 'human-only');
      for (const section of visible) {
        lines.push('');
        lines.push(`${section.title.toUpperCase()}:`);
        for (const item of section.items) {
          lines.push(`- ${item}`);
        }
      }
    }

    return lines.join('\n').trimEnd() + '\n';
  }
}
