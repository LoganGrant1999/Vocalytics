# Vocalytics Frontend

YouTube comment sentiment analysis and AI-powered reply generation - Frontend application.

## Project Status

**Status**: Ready for Backend Integration
**Frontend**: ✅ Complete (UI + routing + components)
**Backend**: ⚠️ Needs integration (see `BACKEND_MIGRATION_PROMPT.md`)

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: install with [nvm](https://github.com/nvm-sh/nvm))
- Backend API running on port 3000 (see integration docs)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd reply-sculptor

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

## Integration with Backend

This frontend connects to the Vocalytics backend API. To integrate:

1. **Read the integration overview**: `INTEGRATION_OVERVIEW.md`
2. **Prepare backend first**: Use `BACKEND_MIGRATION_PROMPT.md` in your backend repo
3. **Configure environment**: Set `VITE_API_URL` in `.env`
4. **Review integration guide**: `INTEGRATION_GUIDE.md` for detailed steps

### Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:3000  # Backend API URL
```

## Project info

**Original Lovable URL**: https://lovable.dev/projects/ea5894f0-f019-464b-8591-976f8bce3504

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ea5894f0-f019-464b-8591-976f8bce3504) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Tech Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Data Fetching**: TanStack Query
- **Routing**: React Router v6
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend (Separate Repo)
- **Framework**: Fastify
- **Database**: Supabase (PostgreSQL)
- **Auth**: YouTube OAuth + JWT
- **AI**: OpenAI GPT-4
- **Billing**: Stripe
- **Deployment**: Vercel

## Features

- ✅ **YouTube Integration**: OAuth authentication and video/comment fetching
- ✅ **Sentiment Analysis**: AI-powered comment analysis (OpenAI)
- ✅ **Reply Generation**: GPT-4 generated replies in creator's voice
- ✅ **Billing**: Stripe integration with Free/Pro tiers
- ✅ **Dashboard**: KPIs, priority queue, voice profile
- ✅ **Responsive Design**: Mobile-first with dark mode support

## Project Structure

```
reply-sculptor/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   └── shared/       # Shared app components
│   ├── pages/            # Route pages
│   ├── hooks/            # Custom React hooks (add API hooks here)
│   ├── lib/              # Utilities (add api.ts here)
│   └── App.tsx           # Root component
├── INTEGRATION_OVERVIEW.md       # Start here!
├── INTEGRATION_GUIDE.md          # Detailed integration steps
├── BACKEND_MIGRATION_PROMPT.md   # Give to Claude in backend repo
└── README.md                      # This file
```

## Development

### Available Scripts

```bash
npm run dev        # Start dev server (port 8080)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Development Workflow

1. **Backend**: Start backend API on port 3000
2. **Frontend**: Start frontend dev server on port 8080
3. **Browser**: Navigate to `http://localhost:8080`

## Deployment

### Option 1: Separate Deployments
- **Frontend**: Vercel/Netlify (static hosting)
- **Backend**: Vercel/Railway/Render (Node.js hosting)
- **Requirements**: Configure CORS in backend

### Option 2: Monorepo (Recommended)
Move frontend into backend repo as `client/` directory for single deployment.

### Deploy via Lovable
Simply open [Lovable](https://lovable.dev/projects/ea5894f0-f019-464b-8591-976f8bce3504) and click Share → Publish.

### Custom Domain
To connect a domain via Lovable: Project > Settings > Domains > Connect Domain

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain)

## API Integration Status

- [ ] Auth endpoints (`/api/auth/*`)
- [ ] YouTube endpoints (`/api/youtube/*`)
- [ ] Analysis endpoint (`/api/analyze-comments`)
- [ ] Reply endpoints (`/api/generate-replies`, `/api/youtube/reply`)
- [ ] Billing endpoints (`/api/billing/*`)

See `INTEGRATION_GUIDE.md` for implementation checklist.

## License

MIT

## Support

For integration help, see:
- `INTEGRATION_OVERVIEW.md` - Start here for big picture
- `INTEGRATION_GUIDE.md` - Detailed technical steps
- `BACKEND_MIGRATION_PROMPT.md` - Backend preparation prompt
