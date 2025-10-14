# TubeWhisperer

TypeScript monorepo with pnpm workspaces.

## Requirements

- Node.js 20.x (use `nvm use` to switch to the correct version)
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
pnpm dev       # Start Vite dev server on http://localhost:5173
pnpm build     # Build static site for production
pnpm preview   # Preview production build
pnpm typecheck # Run TypeScript type checking
```

## Project Structure

```
.
├── packages/
│   ├── server/          # Backend API (Hono + Supabase + Stripe)
│   │   └── src/
│   └── web/             # Frontend web app (React + Vite)
│       ├── src/
│       ├── vercel.json  # Vercel deployment config
│       └── .env.example # Environment variables template
├── .github/
│   └── workflows/
│       ├── ci.yml       # CI: lint, typecheck, test, build
│       └── web.yml      # Web build on PRs
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

## Web MVP

The frontend React application provides a user-friendly interface for YouTube comment analysis and reply generation.

### Features

- **YouTube OAuth Integration** - Connect your YouTube account
- **Video Selection** - Choose videos to analyze
- **Sentiment Analysis** - View comment sentiment distribution
- **AI Reply Generation** - Generate contextual replies for comments
- **Usage Tracking** - Monitor free tier limits
- **Stripe Integration** - Upgrade to Pro for unlimited usage
- **Debug Console** - View API request history and request IDs
- **Analytics** - Optional PostHog integration for user behavior tracking

### Quick Start

1. **Set up environment**:
   ```bash
   cd packages/web
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start development server**:
   ```bash
   pnpm --filter web dev
   ```

3. **Access the app**: Open `http://localhost:5173`

### Deployment

The web app is configured for Vercel deployment with automatic builds on pull requests.

**Deploy to Vercel**:

1. Import the repository to Vercel
2. Select `packages/web` as the root directory
3. Add environment variables:
   - `VITE_ENABLE_POSTING=false` (optional)
   - `VITE_POSTHOG_KEY=your_key` (optional)
4. Update `packages/web/vercel.json` API rewrites to point to your backend

See `packages/web/README.md` for detailed deployment instructions.

### CI/CD

GitHub Actions automatically:
- Runs type checking on PRs
- Builds the web package
- Uploads build artifacts

See `.github/workflows/web.yml` for CI configuration.
