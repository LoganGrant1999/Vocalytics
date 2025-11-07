# @vocalytics/web

React + TypeScript + Vite frontend for Vocalytics.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **TanStack Query** - Data fetching
- **shadcn/ui** - UI components
- **Lucide React** - Icons

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Install Dependencies

```bash
# From workspace root
pnpm -w install
```

### Run Dev Server

```bash
# From workspace root
pnpm --filter web dev
```

The app will be available at `http://localhost:5173`.

API requests to `/api/*` are proxied to `http://localhost:3000` (the backend server).

### Build for Production

```bash
pnpm --filter web build
```

Build output will be in `dist/`.

### Type Checking

```bash
pnpm --filter web typecheck
```

### Preview Production Build

```bash
pnpm --filter web preview
```

## Project Structure

```
src/
├── components/     # Reusable components
│   └── ui/         # shadcn/ui components
├── pages/          # Page components
├── lib/            # Utilities (cn, etc.)
├── App.tsx         # Root component with routing
├── main.tsx        # React entry point
└── index.css       # Global styles + Tailwind
```

## API Integration

The app uses TanStack Query for data fetching. API calls are made to `/api/*` which Vite proxies to the backend server in development.

In production (Vercel), configure rewrites in `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-api.vercel.app/api/$1"
    }
  ]
}
```

## Environment Variables

See `.env.example` for all available configuration options.

Create `.env` for local development:

```bash
cp .env.example .env
```

Key variables:

- **`VITE_ENABLE_POSTING`** - Enable YouTube reply posting (requires `youtube.force-ssl` scope)
- **`VITE_POSTHOG_KEY`** - PostHog analytics key (optional)
- **`VITE_POSTHOG_HOST`** - PostHog host URL (optional)

## Deployment

### Vercel (Recommended)

#### Option 1: Vercel Dashboard

1. Import your repository to Vercel
2. Select the `packages/web` directory as the root
3. Vercel will auto-detect Vite configuration
4. Add environment variables in Vercel dashboard:
   - `VITE_ENABLE_POSTING=false`
   - `VITE_POSTHOG_KEY=your_key` (optional)
5. Update `vercel.json` rewrites to point to your backend URL

#### Option 2: Vercel CLI

```bash
cd packages/web
vercel --prod
```

The app will be deployed as a static site with API routes proxied via Vercel rewrites configured in `vercel.json`.

**Important**: Update the API rewrite destination in `vercel.json` to point to your backend:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.vercel.app/api/:path*"
    }
  ]
}
```

### Other Platforms

For other static hosts (Netlify, Cloudflare Pages, etc.):

1. Build command: `cd ../.. && pnpm install && pnpm --filter web build`
2. Output directory: `packages/web/dist`
3. Add rewrites/redirects for `/api/*` to your backend URL

## Adding UI Components

This project uses shadcn/ui. To add more components:

1. Visit [shadcn/ui](https://ui.shadcn.com)
2. Browse components
3. Copy component code into `src/components/ui/`
4. Import and use in your pages

Example components already included:
- Button

## Path Aliases

TypeScript is configured with `@/` alias for `src/`:

```tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm typecheck` - Run TypeScript type checking
