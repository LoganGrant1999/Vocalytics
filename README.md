# Vocalytics

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

Vocalytics can use real OpenAI APIs for comment moderation and reply generation. By default, it falls back to mock/rule-based behavior if no API key is configured.

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

## Vocalytics Brand Integration

The application implements a comprehensive brand identity system with design tokens, components, and theme support.

### Design System

**Color Palette**:
- Primary: `#E63946` (Vocalytics Red)
- Hover: `#CC2F3A`
- Light: `#FF6B6B`
- Background: `#FFFFFF` (light) / `#0E0E11` (dark)
- Surface: `#FFFFFF` (light) / `#18181B` (dark)
- Status colors: Success, Warning, Error, Info

**Theme Files**:
- `/packages/web/src/styles/theme.css` - CSS custom properties for all brand colors
- `/packages/web/tailwind.config.js` - Tailwind utility class mappings
- `/packages/web/src/index.css` - Global styles and theme import

### Components

**Logo Component**: `/packages/web/src/components/Logo.tsx`
```tsx
import { Logo } from '@/components/Logo';
<Logo className="optional-classes" />
```

**Dark Mode**: `/packages/web/src/hooks/useDarkMode.ts`
```tsx
import { useDarkMode } from '@/hooks/useDarkMode';
const { isDark, toggle } = useDarkMode();
```

### Brand Demo

Visit `/brand` to view the complete brand system showcase including:
- Color palette with hex values
- Typography scale
- Component examples (buttons, cards, inputs)
- Gradient backgrounds
- Dark mode toggle
- Live theme preview

### Using Brand Colors

```tsx
// Tailwind classes
<div className="bg-brand-primary text-brand-text-inverse">
<button className="bg-brand-primary hover:bg-brand-primary-hover">
<p className="text-brand-text-secondary">

// CSS variables
background: var(--color-primary);
color: var(--color-text-primary);
```

### Assets

Brand images are located in `/packages/web/public/images/`:
- `Vocalytics.png` - Full logo
- `Favicon.png` - App icon
- `Banner.png` - Social media banner (Open Graph, Twitter cards)

## Secondary Color Usage

The Vocalytics brand system includes a secondary gray palette for navigation chrome, neutral UI elements, and data visualization.

### When to Use Secondary Colors

**Navigation & Chrome** (`brand-secondary`, `brand-secondary-light`):
- Top navbar background
- Sidebar background
- Footer areas
- Modal overlays

**Labels & Muted Text** (`brand-secondary-muted`):
- Table headers
- Chart axis labels
- Form labels
- Helper text
- Timestamps

**Interactive States** (`brand-secondary-ghost`):
- Hover overlays on dark backgrounds
- Focus states on navigation items
- Subtle button backgrounds

**Keep Primary Red For**:
- Call-to-action buttons
- Active states and highlights
- Links and interactive elements
- Error states and alerts

### Dark Mode Mappings

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `brand-secondary` | `#374151` (slate-700) | `#9CA3AF` (slate-400) |
| `brand-secondary-light` | `#4B5563` (slate-600) | `#6B7280` (slate-500) |
| `brand-secondary-muted` | `#6B7280` (slate-500) | `#9CA3AF` (slate-400) |
| `brand-secondary-ghost` | `rgba(55,65,81,0.08)` | `rgba(156,163,175,0.14)` |

### Components

**SecondaryButton** - Use for neutral, non-primary actions:
```tsx
import { SecondaryButton } from '@/components/SecondaryButton';
<SecondaryButton label="Cancel" onClick={handleCancel} />
```

**Chart Theme** - Centralized colors for data visualization:
```tsx
import { chartTheme, getAxisStyle } from '@/components/charts/ChartTheme';
// Use chartTheme.axisColor for axis labels
// Use chartTheme.gridColor for grid lines
```

### Accessibility

All secondary colors maintain WCAG AA contrast ratios:
- White text on `brand-secondary`: 8.59:1 ✓
- White text on `brand-secondary-light`: 6.94:1 ✓
- `brand-secondary-muted` on white: 4.69:1 ✓
