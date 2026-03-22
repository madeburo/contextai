import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator } from './base.js';

export class LlmsTxtGenerator extends BaseGenerator {
  readonly outputKey = 'llms.txt' as const;
  readonly outputPath = 'llms.txt';

  generate(config: ContextConfig): string {
    const { project, conventions } = config;
    const lines: string[] = [];

    lines.push(`# ${project.name}`, '');
    lines.push(`> ${project.architecture}`, '');
    lines.push('## Stack', '');
    for (const item of project.stack) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('## Conventions', '');

    for (const sections of Object.values(conventions)) {
      const visible = sections.filter((s: ConventionSection) => s.scope !== 'human-only');
      for (const section of visible) {
        lines.push(`${section.title}: ${section.items.join('; ')}`);
      }
    }

    lines.push('');
    lines.push('## Links');

    return lines.join('\n').trimEnd() + '\n';
  }
}
