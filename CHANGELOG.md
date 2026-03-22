# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-22

### Added

- `contextai init` — interactive setup wizard with framework detection
- `contextai generate` — generate output files from `context.config.ts`
- `contextai generate --dry-run` — preview output without writing
- `contextai validate` — check output files are fresh and well-structured
- `contextai diff` — show diff between config and on-disk outputs
- `contextai watch` — watch config for changes and regenerate automatically
- Built-in generators: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `llms.txt`
- Custom generator support via config
- Built-in framework templates: Next.js, NestJS, Express, Remix, SvelteKit
- Convention scopes (`agent-only`, `human-only`)
- Git pre-commit hook installer
- Programmatic API via `contextai` package exports
- Zod-based config validation with clear error messages
- `defineContext()` helper for type-safe config authoring
