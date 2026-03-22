import type { ContextConfig, ConventionSection } from '../types.js';
import { BaseGenerator } from './base.js';

export class CopilotGenerator extends BaseGenerator {
  readonly outputKey = '.github/copilot-instructions.md' as const;
  readonly outputPath = '.github/copilot-instructions.md';

  generate(config: ContextConfig): string {
    const { project, conventions } = config;
    const lines: string[] = [];

    lines.push('---');
    lines.push('applyTo: "**"');
    lines.push('---', '');
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
