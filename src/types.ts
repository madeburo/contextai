// Core config types

export interface ProjectConfig {
  name: string;
  stack: string[];
  architecture: string;
}

export interface ConventionSection {
  title: string;
  items: string[];
  scope?: 'agent-only' | 'human-only';
}

export interface ConventionsConfig {
  [key: string]: ConventionSection[];
}

export interface OutputsConfig {
  'AGENTS.md'?: boolean;
  'CLAUDE.md'?: boolean;
  '.cursorrules'?: boolean;
  '.github/copilot-instructions.md'?: boolean;
  'llms.txt'?: boolean;
  '.kiro/steering'?: boolean;
  '.windsurf/rules'?: boolean;
  'GEMINI.md'?: boolean;
  custom?: Array<{ path: string; generator: (config: ContextConfig) => string }>;
}

export type OutputKey = keyof Omit<OutputsConfig, 'custom'>;

export type TemplateName = 'nextjs' | 'nestjs' | 'express' | 'remix' | 'sveltekit';

export interface ContextConfig {
  project: ProjectConfig;
  conventions: ConventionsConfig;
  outputs: OutputsConfig;
  templates?: TemplateName[];
}

// Intermediate representation for round-trip serialization
export interface ContextConfigIR {
  version: 1;
  project: ProjectConfig;
  conventions: ConventionsConfig;
  outputs: OutputsConfig;
  templates: TemplateName[];
}

// Scanner types
export type FrameworkName = 'nextjs' | 'nestjs' | 'express' | 'remix' | 'sveltekit';

export interface Scanner {
  scan(projectRoot: string): Promise<ScanResult>;
}

export interface ScanResult {
  detectedFrameworks: FrameworkName[];
  hasTypeScript: boolean;
  hasPrisma: boolean;
  packageJson: Record<string, unknown> | null;
}

// Diff types
export interface DiffHunk {
  lines: Array<{ type: '+' | '-' | ' '; content: string }>;
}

export interface DiffResult {
  hasChanges: boolean;
  hunks: DiffHunk[];
}

// DiffEngine interface
export interface DiffEngine {
  diff(inMemory: string, onDisk: string): DiffResult;
}
