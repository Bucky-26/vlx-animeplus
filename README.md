# vlx-animeplus

Anime streaming API and player built with Node.js, Express, Supabase, AniList, and MegaPlay.

This project exposes anime metadata and stream endpoints, serves a built-in player UI, and includes a Supabase-backed CORS allowlist and admin panel for managing trusted browser origins.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Bucky-26/vlx-animeplus)

## Features

- Search and resolve anime metadata from AniList
- Resolve MegaPlay stream sources for each episode
- Proxy HLS playlists, media segments, and subtitle files
- Serve HTML player pages and JSON API responses
- Protect API access with origin-based allowlisting
- Manage trusted origins through an admin dashboard
- Deploy easily on Vercel

## Tech stack

- Node.js
- Express
- Supabase
- AniList GraphQL API
- MegaPlay stream source integration
- Vercel-ready serverless wrapper

## Project structure

```text
.
├── api/
│   └── index.js
├── public/
│   ├── admin.html
│   └── index.html
├── src/
│   ├── providers/
│   │   ├── anime.js
│   │   └── index.js
│   ├── routes/
│   │   ├── admin.js
│   │   └── anime.js
│   ├── services/
│   │   └── corsAllowlist.js
│   └── templates/
│       ├── animePlayer.js
│       └── index.js
├── .env.example
├── .env
├── index.js
├── package.json
├── supabase.sql
├── vercel.json
└── README.md
```

## Requirements

- Node.js 18+
- A Supabase project
- A valid Supabase service role key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
copy .env.example .env
```

3. Update the values in `.env`:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_ADMIN_EMAILS=admin@example.com
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
CORS_CACHE_TTL_MS=60000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## Database setup

Run the SQL in `supabase.sql` in your Supabase SQL editor.

This creates the allowlist table used by the admin interface and the runtime CORS enforcement logic.

## Run locally

Start the app:

```bash
npm start
```

Or use watch mode during development:

```bash
npm run dev
```

Then open:

- http://localhost:3000
- http://localhost:3000/admin

## Admin panel

The admin UI is available at `/admin`.

Login with a Supabase-authenticated user account, then add trusted browser origins to the `cors_origins` table. Requests with an `Origin` header are rejected unless the origin is explicitly allowlisted.

`SUPABASE_ADMIN_EMAILS` can be used to limit who is allowed to access the admin panel.

## API routes

### Main app routes

- `/` — landing page
- `/health` — health check
- `/admin` — admin dashboard

### Anime routes

- `/anime/:id/:episode`
- `/anime/:id/:season/:episode`
- `/api/anime/:id`
- `/api/anime/:id/:episode`
- `/api/anime/:id/:season/:episode`

Use `?format=json` on the `/api/anime/...` routes when you want JSON instead of the HTML player page.

### Proxy routes

- `/anime/m3u8?url=...`
- `/anime/proxy?url=...`
- `/anime/sub?url=...`
- `/api/anime/m3u8?url=...`
- `/api/anime/proxy?url=...`
- `/api/anime/sub?url=...`

## Vercel deployment

This project is Vercel-ready.

1. Import the repo into Vercel as a new project.
2. Set the same environment variables in the Vercel dashboard.
3. Use the project root as the deployment root.

The app uses `api/index.js` as the entry point for serverless deployment.

## Security notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only.
- Never expose it to browser-side code.
- Prefer the Supabase allowlist over the temporary `CORS_ALLOWED_ORIGINS` fallback.
- Only add trusted origins to the admin allowlist.

## License

This project is licensed under a custom non-commercial license.

See `LICENSE.md` for full terms, including ownership of project modifications by the developer and prohibition of commercial distribution.
