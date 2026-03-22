# contextai

[![npm version](https://img.shields.io/npm/v/contextai.svg)](https://www.npmjs.com/package/contextai)
[![license](https://img.shields.io/npm/l/contextai.svg)](LICENSE)
[![node](https://img.shields.io/node/v/contextai.svg)](package.json)
[![npm downloads](https://img.shields.io/npm/dm/contextai.svg)](https://www.npmjs.com/package/contextai)

Universal context engineering CLI for AI coding agents. Define your project's conventions, stack, and architecture in a single `context.config.ts` file, then generate AI-readable context files for multiple tools from that single source of truth.

## Supported output targets

| Target | File |
|--------|------|
| OpenAI Codex / generic agents | `AGENTS.md` |
| Claude | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| LLMs.txt | `llms.txt` |
| Kiro (AWS) | `.kiro/steering/*.md` |
| Custom | any path via config |

## Quick start

```bash
npm install -g contextai

# Interactive setup — creates context.config.ts
contextai init

# Generate all enabled output files
contextai generate
```

## Commands

| Command | Description |
|---------|-------------|
| `contextai init` | Interactive setup wizard |
| `contextai generate` | Generate output files from config |
| `contextai generate --dry-run` | Preview output without writing files |
| `contextai validate` | Check output files are fresh and well-structured |
| `contextai diff` | Show diff between config and on-disk outputs |
| `contextai watch` | Watch config for changes and regenerate automatically |

## Configuration

Create a `context.config.ts` at your project root:

```typescript
import { defineContext } from 'contextai';

export default defineContext({
  project: {
    name: 'my-app',
    stack: ['TypeScript', 'React', 'Node.js'],
    architecture: 'Monorepo with shared packages',
  },
  conventions: {
    code: [
      {
        title: 'Naming',
        items: ['camelCase for variables', 'PascalCase for components'],
      },
    ],
  },
  outputs: {
    'AGENTS.md': true,
    'CLAUDE.md': true,
    '.cursorrules': true,
    '.github/copilot-instructions.md': true,
    'llms.txt': true,
    '.kiro/steering': true,
  },
});
```

### Custom generators

```typescript
export default defineContext({
  // ...
  outputs: {
    'CLAUDE.md': true,
    custom: [
      {
        path: 'docs/ai-context.md',
        generator: (config) => `# ${config.project.name}\n${config.project.architecture}`,
      },
    ],
  },
});
```

### Built-in templates

Detected frameworks get convention templates applied automatically. Supported: `nextjs`, `nestjs`, `express`, `remix`, `sveltekit`.

```typescript
export default defineContext({
  // ...
  templates: ['nextjs'],
});
```

## Convention scopes

Each convention section can have an optional `scope`:

- `'agent-only'` — included only in AI-facing output files
- `'human-only'` — excluded from generated output
- omitted — included everywhere

```typescript
conventions: {
  security: [
    {
      title: 'Auth',
      items: ['Use JWT tokens', 'Rotate secrets quarterly'],
      scope: 'agent-only',
    },
  ],
},
```

## Git hook

During `contextai init`, you can optionally install a `pre-commit` git hook that runs `contextai generate` and stages the output files automatically.

## Programmatic API

```typescript
import { DefaultConfigParser, DefaultTemplateRegistry, defineContext } from 'contextai';

const parser = new DefaultConfigParser();
const config = await parser.load('./context.config.ts');
```

## Requirements

- Node.js >= 20

## License

[MIT](LICENSE)
