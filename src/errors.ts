export class ConfigParseError extends Error {
  constructor(
    public filePath: string,
    public line: number,
    message: string
  ) {
    super(message);
    this.name = 'ConfigParseError';
    Object.setPrototypeOf(this, ConfigParseError.prototype);
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public filePath: string,
    public invalidField: string,
    message: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

export class UnknownTemplateError extends Error {
  constructor(public templateName: string) {
    super(`Unknown template: "${templateName}"`);
    this.name = 'UnknownTemplateError';
    Object.setPrototypeOf(this, UnknownTemplateError.prototype);
  }
}

export class GeneratorWriteError extends Error {
  constructor(
    public outputPath: string,
    message: string
  ) {
    super(message);
    this.name = 'GeneratorWriteError';
    Object.setPrototypeOf(this, GeneratorWriteError.prototype);
  }
}

export class PathTraversalError extends Error {
  constructor(
    public outputPath: string,
    public resolvedPath: string,
  ) {
    super(`Path traversal detected: "${outputPath}" resolves outside project root`);
    this.name = 'PathTraversalError';
    Object.setPrototypeOf(this, PathTraversalError.prototype);
  }
}

export class BlacklistedPathError extends Error {
  constructor(
    public outputPath: string,
    public pattern: string,
  ) {
    super(`Output path "${outputPath}" targets a protected directory (${pattern})`);
    this.name = 'BlacklistedPathError';
    Object.setPrototypeOf(this, BlacklistedPathError.prototype);
  }
}
