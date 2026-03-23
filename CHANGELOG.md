# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-23

### Added

- Windsurf generator — outputs `.windsurf/rules/project-context.md` with YAML frontmatter `trigger: always_on` so Cascade loads context automatically in every interaction
- Enable via `'.windsurf/rules': true` in `outputs` config
- Gemini generator — outputs `GEMINI.md` in project root, plain markdown without frontmatter
- Covers both Gemini CLI and Antigravity (Google); Antigravity also reads `AGENTS.md` which was already supported
- Enable via `'GEMINI.md': true` in `outputs` config
- `--format json` flag on `contextai generate` — outputs JSON IR to stdout instead of writing files
- Structure: `{ version, generatedAt, config, outputs }` — useful for CI, piping, and debugging
- Total supported targets now: CLAUDE.md, .cursorrules, AGENTS.md, .github/copilot-instructions.md, llms.txt, .kiro/steering, .windsurf/rules, GEMINI.md, and custom generators

## [0.2.0] - 2026-03-22

### Added

- Kiro (AWS) steering file generator — outputs `.kiro/steering/product.md`, `.kiro/steering/tech.md`, and `.kiro/steering/conventions.md` from a single config
- All steering files include `inclusion: always` frontmatter so Kiro loads them in every interaction
- Enable via `'.kiro/steering': true` in `outputs` config
- Convention scoping respected: `human-only` sections excluded, `agent-only` and unscoped sections included

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
