# Contributing to contextai

Thanks for your interest in contributing. Here's how to get started.

**Website:** [www.contextai.run](https://www.contextai.run)

## Setup

```bash
git clone https://github.com/madeburo/contextai.git
cd contextai
npm install
```

## Development

```bash
# Build
npm run build

# Run tests (single pass)
npm test

# Run a specific test file
npx vitest --run src/config-parser.test.ts
```

## Project structure

```
src/
  cli.ts                  # CLI entry point
  index.ts                # Public library API
  types.ts                # Shared TypeScript interfaces
  errors.ts               # Custom error classes
  config-parser.ts        # Loads and validates context.config.ts
  scanner.ts              # Detects frameworks in a project
  diff-engine.ts          # Line-level diffing
  template-registry.ts    # Built-in framework templates
  watcher.ts              # File watcher (chokidar)
  git-hook-installer.ts   # Git pre-commit hook installer
  commands/               # One file per CLI command
  generators/             # One file per output target
  templates/              # Built-in framework convention templates (JSON)
```

## Conventions

- Every source file has a co-located test file: `foo.ts` → `foo.test.ts`
- Commands export a single `run*` function (e.g. `runGenerate`)
- Generators extend `BaseGenerator` from `generators/base.ts`
- All shared types live in `types.ts`
- Domain errors use custom classes from `errors.ts` — never throw plain `Error`
- Imports use `.js` extension even for `.ts` files (required for CJS output)

## Adding a new generator

1. Create `src/generators/my-target.ts` extending `BaseGenerator`
2. Implement `generate(config)` returning the file content as a string
3. Add the output key to `OutputsConfig` in `src/types.ts`
4. Register it in `buildGenerators()` in `src/commands/generate.ts`
5. Add expected headers to `EXPECTED_HEADERS` in `src/commands/validate.ts`
6. Create `src/generators/my-target.test.ts`

## Adding a new template

1. Create `src/templates/my-framework.json` following the existing format
2. Add the name to `TemplateName` union in `src/types.ts`
3. Import and register it in `src/template-registry.ts`
4. Add detection patterns to `FRAMEWORK_INDICATORS` in `src/scanner.ts`

## Code quality

- Run `npm test` before submitting a PR — all 92 tests must pass
- No `any` types unless absolutely necessary (and suppressed with eslint comment)
- Use `instanceof Error` checks instead of `as Error` casts in catch blocks
- All generator writes go through `resolveOutputPath()` for path traversal protection

## Submitting changes

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Run `npm test` to verify
4. Open a pull request with a clear description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
