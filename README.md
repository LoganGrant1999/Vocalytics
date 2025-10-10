# TubeWhisperer

TypeScript monorepo with pnpm workspaces.

## Requirements

- Node.js 20+
- pnpm

## Setup

```bash
pnpm install
```

## Commands

### Root

- `pnpm install` - Install all dependencies
- `pnpm build` - Build all packages
- `pnpm test` - Run tests
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Type check all packages

### Server (`packages/server`)

```bash
cd packages/server
pnpm dev       # Start development server with watch mode
pnpm build     # Build for production
pnpm start     # Start production server
```

### Web (`packages/web`)

```bash
cd packages/web
pnpm build     # Build ESM bundle with esbuild
```

## Project Structure

```
.
├── packages/
│   ├── server/          # Server package
│   │   └── src/
│   └── web/             # Web package (esbuild → ESM)
│       └── src/
├── .github/
│   └── workflows/
│       └── ci.yml       # CI: lint, typecheck, test, build
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json        # TypeScript strict mode
```

## Configuration

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript
- **Prettier**: Code formatting
- **Vitest**: Testing framework
- **GitHub Actions**: Automated CI on push

## Live LLM Mode

TubeWhisperer can use real OpenAI APIs for comment moderation and reply generation. By default, it falls back to mock/rule-based behavior if no API key is configured.

**To enable real moderation + GPT-4 replies:**

```bash
export OPENAI_API_KEY=sk-...

# Optional overrides:
export REPLIES_MODEL=gpt-4o-mini
export MODERATION_MODEL=omni-moderation-latest
```

With these env vars set:
- `analyzeComments()` will use OpenAI's moderation API as a first-pass filter to detect toxic/spam content
- `generateReplies()` will use GPT-4o-mini to synthesize contextual replies in the requested tone
- If any API call fails (timeout/rate limit/etc), the system gracefully falls back to mock templates

**Without** `OPENAI_API_KEY`:
- All tools work in mock mode using keyword heuristics and template replies
- Smoke tests remain green
