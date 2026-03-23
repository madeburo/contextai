import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DefaultScanner } from '../scanner.js';
import { DefaultTemplateRegistry } from '../template-registry.js';
import { DefaultGitHookInstaller } from '../git-hook-installer.js';
import { info, success, warn, fmt } from '../logger.js';
import type { TemplateName } from '../types.js';

const OUTPUT_KEYS = [
  'AGENTS.md',
  '.cursorrules',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'llms.txt',
  '.kiro/steering',
  '.windsurf/rules',
  'GEMINI.md',
] as const;

export interface InitPrompts {
  input(opts: { message: string; default?: string }): Promise<string>;
  checkbox(opts: {
    message: string;
    choices: Array<{ name: string; value: string; checked?: boolean }>;
  }): Promise<string[]>;
  confirm(opts: { message: string; default?: boolean }): Promise<boolean>;
}

export interface InitOptions {
  // Injectable prompts for testing — if not provided, uses @inquirer/prompts
  prompts?: InitPrompts;
}

export interface InitResult {
  configPath: string;
  installedGitHook: boolean;
}

async function getInquirerPrompts(): Promise<InitPrompts> {
  const { input, checkbox, confirm } = await import('@inquirer/prompts');
  return { input, checkbox, confirm };
}

function buildConfigFileContent(params: {
  name: string;
  stack: string[];
  selectedOutputs: string[];
  templateNames: TemplateName[];
  conventions: Record<string, unknown>;
}): string {
  const { name, stack, selectedOutputs, templateNames, conventions } = params;

  const escapeTs = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const stackItems = stack.map((s) => `'${escapeTs(s)}'`).join(', ');

  const outputsEntries = OUTPUT_KEYS.map((key) => {
    const enabled = selectedOutputs.includes(key);
    return `    '${key}': ${enabled},`;
  }).join('\n');

  const conventionsStr =
    Object.keys(conventions).length > 0
      ? JSON.stringify(conventions, null, 2)
          .split('\n')
          .map((l, i) => (i === 0 ? l : '  ' + l))
          .join('\n')
      : '{}';

  const templatesStr =
    templateNames.length > 0
      ? `  templates: [${templateNames.map((t) => `'${t}'`).join(', ')}],\n`
      : '';

  return `import { defineContext } from 'contextai';

export default defineContext({
  project: {
    name: '${escapeTs(name)}',
    stack: [${stackItems}],
    architecture: '',
  },
  conventions: ${conventionsStr},
  outputs: {
${outputsEntries}
  },
${templatesStr}});
`;
}

export async function runInit(
  projectRoot: string,
  options?: InitOptions
): Promise<InitResult> {
  const prompts = options?.prompts ?? (await getInquirerPrompts());

  // 1. Scan the project
  const scanner = new DefaultScanner();
  const scanResult = await scanner.scan(projectRoot);

  // 2. Determine defaults from scan
  const packageName =
    typeof scanResult.packageJson?.name === 'string'
      ? (scanResult.packageJson.name as string)
      : '';

  const detectedStack = scanResult.detectedFrameworks.length > 0
    ? scanResult.detectedFrameworks
    : scanResult.hasTypeScript
    ? ['TypeScript']
    : ['JavaScript'];

  // 3. Collect template conventions if a known framework was detected
  const registry = new DefaultTemplateRegistry();
  const detectedTemplates: TemplateName[] = scanResult.detectedFrameworks.filter(
    (f): f is TemplateName => registry.list().includes(f as TemplateName)
  );

  let conventions: Record<string, unknown> = {};
  if (detectedTemplates.length > 0) {
    const merged = registry.merge(
      {
        project: { name: '', stack: [], architecture: '' },
        conventions: {},
        outputs: {},
      },
      detectedTemplates
    );
    conventions = merged.conventions as Record<string, unknown>;
  }

  // 4. Check if config already exists
  const configPath = path.join(projectRoot, 'context.config.ts');
  let configExists = false;
  try {
    await fs.access(configPath);
    configExists = true;
  } catch {
    // doesn't exist
  }

  if (configExists) {
    const overwrite = await prompts.confirm({
      message: 'context.config.ts already exists. Overwrite?',
      default: false,
    });
    if (!overwrite) {
      return { configPath, installedGitHook: false };
    }
  }

  // 5. Interactive prompts
  const name = await prompts.input({
    message: 'Project name:',
    default: packageName || undefined,
  });

  const stackInput = await prompts.input({
    message: 'Stack (comma-separated):',
    default: detectedStack.join(', '),
  });
  const stack = stackInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const selectedOutputs = await prompts.checkbox({
    message: 'Which output files do you want to generate?',
    choices: OUTPUT_KEYS.map((key) => ({ name: key, value: key, checked: true })),
  });

  const installGitHook = await prompts.confirm({
    message: 'Install git pre-commit hook to auto-generate context files?',
    default: false,
  });

  // 6. Write context.config.ts
  const content = buildConfigFileContent({
    name,
    stack,
    selectedOutputs,
    templateNames: detectedTemplates,
    conventions,
  });

  await fs.writeFile(configPath, content, 'utf-8');

  // 7. Optionally install git hook
  let installedGitHook = false;
  if (installGitHook) {
    try {
      const installer = new DefaultGitHookInstaller();
      await installer.install(projectRoot);
      installedGitHook = true;
    } catch {
      // Git hook installation failed (e.g., not a git repo) — skip silently
      warn('Could not install git hook (not a git repository?)');
    }
  }

  // Summary
  info('');
  success(`Created ${configPath}`);
  if (selectedOutputs.length > 0) {
    info(`  Outputs: ${selectedOutputs.join(', ')}`);
  }
  if (installedGitHook) {
    success('Installed git pre-commit hook');
  }
  info(`\nNext step: run ${fmt.cyan('contextai generate')} to create output files.`);

  return { configPath, installedGitHook };
}
