export { defineContext } from './defineContext.js';
export { DefaultConfigParser } from './config-parser.js';
export type { ConfigParser } from './config-parser.js';
export { DefaultTemplateRegistry } from './template-registry.js';
export type { Template, TemplateRegistry } from './template-registry.js';
export { DefaultScanner } from './scanner.js';
export type { Scanner } from './types.js';

export type {
  ContextConfig,
  ProjectConfig,
  ConventionsConfig,
  ConventionSection,
  OutputsConfig,
  OutputKey,
  ContextConfigIR,
  ScanResult,
  FrameworkName,
  TemplateName,
  DiffResult,
  DiffHunk,
} from './types.js';

export {
  ConfigParseError,
  ConfigValidationError,
  UnknownTemplateError,
  GeneratorWriteError,
  PathTraversalError,
  BlacklistedPathError,
} from './errors.js';
