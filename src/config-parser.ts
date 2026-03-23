import { z } from 'zod';
import type { ContextConfig } from './types.js';
import { ConfigParseError, ConfigValidationError } from './errors.js';

// Zod schema matching ContextConfig — strict() catches unknown fields
const ConventionSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
  scope: z.enum(['agent-only', 'human-only']).optional(),
}).strict();

const ProjectConfigSchema = z.object({
  name: z.string(),
  stack: z.array(z.string()),
  architecture: z.string(),
}).strict();

const OutputsConfigSchema = z.object({
  'AGENTS.md': z.boolean().optional(),
  'CLAUDE.md': z.boolean().optional(),
  '.cursorrules': z.boolean().optional(),
  '.github/copilot-instructions.md': z.boolean().optional(),
  'llms.txt': z.boolean().optional(),
  '.kiro/steering': z.boolean().optional(),
  '.windsurf/rules': z.boolean().optional(),
  'GEMINI.md': z.boolean().optional(),
  custom: z.array(
    z.object({
      path: z.string(),
      generator: z.function().args(z.any()).returns(z.string()),
    })
  ).optional(),
}).strict();

const TemplateNameSchema = z.enum(['nextjs', 'nestjs', 'express', 'remix', 'sveltekit']);

const ContextConfigSchema = z.object({
  project: ProjectConfigSchema,
  conventions: z.record(z.string(), z.array(ConventionSectionSchema)),
  outputs: OutputsConfigSchema,
  templates: z.array(TemplateNameSchema).optional(),
}).strict();

export interface ConfigParser {
  load(filePath: string): Promise<ContextConfig>;
}

export class DefaultConfigParser implements ConfigParser {
  async load(filePath: string): Promise<ContextConfig> {
    let module: Record<string, unknown>;

    try {
      // Use jiti to execute the TypeScript config module (interopDefault: false so we can detect missing default)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jiti = require('jiti') as (caller: string, opts?: Record<string, unknown>) => NodeRequire;
      const jitiRequire = jiti(filePath, { interopDefault: false });
      module = jitiRequire(filePath) as Record<string, unknown>;
    } catch (err: unknown) {
      const line = extractLineNumber(err);
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigParseError(
        filePath,
        line,
        `Failed to parse config file "${filePath}"${line > 0 ? ` at line ${line}` : ''}: ${message}`
      );
    }

    // Check for missing default export
    if (!('default' in module) || module.default === undefined || module.default === null) {
      throw new ConfigParseError(
        filePath,
        0,
        `Config file "${filePath}" has no default export. Make sure to use "export default defineContext({...})".`
      );
    }

    // Validate against Zod schema
    const result = ContextConfigSchema.safeParse(module.default);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      // For unrecognized_keys errors, Zod puts the key names in `keys` array
      // and the path points to the parent object — use keys[0] for the field name
      let invalidField: string;
      if (firstIssue?.code === 'unrecognized_keys' && 'keys' in firstIssue && Array.isArray(firstIssue.keys)) {
        const parentPath = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}.` : '';
        invalidField = `${parentPath}${(firstIssue.keys as string[])[0]}`;
      } else {
        invalidField = firstIssue?.path.join('.') ?? 'unknown';
      }
      throw new ConfigValidationError(
        filePath,
        invalidField,
        `Config validation error in "${filePath}": invalid field "${invalidField}". ${firstIssue?.message ?? ''}`
      );
    }

    return result.data as ContextConfig;
  }
}

function extractLineNumber(err: unknown): number {
  if (!(err instanceof Error)) return 0;

  const error = err as Error & { loc?: { line?: number }; line?: number; stack?: string };

  // Check structured location info (e.g., from esbuild/acorn)
  if (error.loc?.line != null) {
    return error.loc.line;
  }
  if (error.line != null) {
    return error.line;
  }

  // Try to extract from stack trace or message: patterns like ":12:" or "line 12"
  const text = `${error.message ?? ''}\n${error.stack ?? ''}`;
  const patterns = [
    /:(\d+):\d+/,       // :12:5
    /line (\d+)/i,      // line 12
    /\((\d+),\d+\)/,    // (12,5)
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return 0;
}
