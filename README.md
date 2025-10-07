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
