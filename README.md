# DevPlatform — Part 1 + 2 + 3: Foundation + GitHub + AI Code Analysis

MERN foundation for an AI-powered developer productivity platform. Part 1 laid
down authentication, protected routes, and a dashboard shell. Part 2 added
GitHub OAuth so a user can connect their account and browse repositories.
Part 3 completes the core loop: fetch a connected repository's source files
from GitHub, send them to Gemini (`gemini-2.5-flash`) for review, and show
the results — score, severity breakdown, and per-issue recommendations — on
an analysis dashboard.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express + Axios
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (Bearer header or httpOnly cookie) + bcrypt password hashing
- **Integrations:** GitHub OAuth (Part 2), Gemini `gemini-2.5-flash` code analysis (Part 3)

## Folder structure

```
devplatform/
├── server/
│   ├── src/
│   │   ├── config/         # env loader, MongoDB connection
│   │   ├── controllers/    # authController.js, githubController.js, analysisController.js
│   │   ├── middleware/     # auth (protect/authorize), centralized error handler
│   │   ├── models/         # User.js, Repository.js, Analysis.js
│   │   ├── routes/         # authRoutes.js, githubRoutes.js, analysisRoutes.js, index.js
│   │   ├── services/       # authService.js, githubService.js (OAuth + GitHub API +
│   │   │                   # file fetching), geminiService.js, analysisService.js
│   │   ├── utils/          # ApiError, JWT helpers, fileFilters.js (ignore rules)
│   │   └── app.js          # Express app setup
│   ├── server.js           # entry point
│   ├── package.json
│   └── .env.example
└── client/
    ├── src/
    │   ├── components/     # Sidebar, Navbar, StatCard, FormInput, PlaceholderPage,
    │   │                   # GithubConnectionCard, RepositoryCard, ScoreGauge,
    │   │                   # SeveritySummary, IssueList
    │   ├── pages/           # Login, Register, Dashboard, Repositories, AnalysisResult
    │   ├── layouts/         # AuthLayout, DashboardLayout
    │   ├── services/        # api.js (axios), authService.js, githubService.js,
    │   │                    # analysisService.js
    │   ├── hooks/            # useAuth, useGithubConnection
    │   ├── context/          # AuthContext (global auth state)
    │   └── routes/           # ProtectedRoute
    ├── package.json
    └── .env.example
```

## Environment variables

**server/.env** (copy from `server/.env.example`):

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Frontend origin, for CORS (default `http://localhost:5173`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `JWT_COOKIE_EXPIRES_DAYS` | httpOnly cookie lifetime in days (default `7`) |
| `GITHUB_CLIENT_ID` | OAuth App client ID from GitHub |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret from GitHub — **server only, never sent to the frontend** |
| `GITHUB_CALLBACK_URL` | Must exactly match the "Authorization callback URL" configured on the GitHub OAuth App (default `http://localhost:5000/api/github/callback`) |
| `GEMINI_API_KEY` | API key for the Gemini API (Google AI Studio) — **server only, never sent to the frontend** |
| `GEMINI_MODEL` | Model used for code analysis (default `gemini-2.5-flash`) |

**client/.env** (copy from `client/.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (default `http://localhost:5000/api`) |

## Running locally

### 1. Backend

```bash
cd server
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev             # nodemon, http://localhost:5000
```

You'll need a MongoDB instance — either local (`mongod`) or a connection string
from MongoDB Atlas — set as `MONGO_URI`.

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173`, register an account, and you'll land on the
protected dashboard. Logging out or visiting `/dashboard` while unauthenticated
redirects to `/login`.

## GitHub OAuth setup

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** anything, e.g. `DevPlatform (local)`
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:5000/api/github/callback`
     (must match `GITHUB_CALLBACK_URL` in `server/.env` exactly)
3. Register the app, then copy the **Client ID** and generate a **Client
   secret**.
4. Paste both into `server/.env` as `GITHUB_CLIENT_ID` and
   `GITHUB_CLIENT_SECRET`.
5. Restart the backend so the new env vars are picked up.

### How the flow works

```
User clicks "Connect GitHub" (browser navigation, not fetch/axios)
 → GET /api/github/connect            [protect: reads the httpOnly cookie]
 → 302 redirect to GitHub's authorize screen, with a signed `state` param
 → user approves on GitHub
 → GitHub redirects to GET /api/github/callback?code=...&state=...
 → state is verified (binds this callback to the user who started the flow)
 → code is exchanged server-side for a GitHub access token (client secret
   used only here, server-to-server)
 → GitHub profile is fetched and saved onto the User document
 → 302 redirect back to the frontend: /dashboard?github=connected
```

The `/connect` step is a real browser navigation (`window.location.href =
".../github/connect"`), not an axios call — that's required for the OAuth
redirect chain to work, and it's why that route is authenticated via the
httpOnly cookie set at login rather than the Bearer token kept in
`localStorage`.

## Required `.env` variables (Part 2 additions)

```
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/github/callback
```

## Gemini AI analysis setup (Part 3)

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Paste it into `server/.env` as `GEMINI_API_KEY`. `GEMINI_MODEL` already
   defaults to `gemini-2.5-flash`, so you only need to set it if you want a
   different model.
3. Restart the backend.

### How the analysis pipeline works

```
User clicks "Analyze Repository" on a repo card
 → (if not already connected) POST /api/github/repositories/:githubId/connect
 → POST /api/analysis/:repositoryId/run                       [protect]
    1. Verify the repository belongs to the requesting user
    2. Fetch the repo's file tree from GitHub (git/trees, recursive)
    3. Filter out node_modules, .git, dist/build, .env, lockfiles, binaries,
       and anything outside a source-code extension allowlist
    4. Fetch blob content for the remaining files, capped at 40 files /
       40KB per file / 150K combined characters
    5. Send the files to Gemini (gemini-2.5-flash) with a JSON response
       schema (severity, category, file, line, description, recommendation,
       suggestedFix) so the output is always structured, valid JSON
    6. Compute an overall 0-100 score and severity counts from the issues
    7. Save an Analysis document in MongoDB, linked to the Repository
 → frontend redirects to /dashboard/repositories/:repositoryId/analysis
   and renders the score, severity breakdown, and issue details
```

### Required `.env` variables (Part 3 additions)

```
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

## API reference

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create an account, returns user + JWT |
| POST | `/api/auth/login` | Public | Authenticate, returns user + JWT |
| POST | `/api/auth/logout` | Private | Clears the auth cookie |
| GET | `/api/auth/me` | Private | Returns the current authenticated user |
| GET | `/api/github/connect` | Private | Redirects to GitHub's OAuth consent screen |
| GET | `/api/github/callback` | Public* | GitHub's redirect target; exchanges code, saves connection |
| GET | `/api/github/profile` | Private | Connection status + public GitHub profile info |
| GET | `/api/github/repositories` | Private | Live list of the user's GitHub repos, including analysis status |
| POST | `/api/github/repositories/:githubId/connect` | Private | Persists a repo for future analysis |
| DELETE | `/api/github/disconnect` | Private | Removes the stored GitHub connection |
| POST | `/api/analysis/:repositoryId/run` | Private | Runs the full GitHub → Gemini → MongoDB pipeline for a connected repo |
| GET | `/api/analysis/:repositoryId/latest` | Private | Most recent analysis for a repository (full issue detail) |
| GET | `/api/analysis/:repositoryId/history` | Private | Past analyses for a repository (score/summary only, no issue detail) |
| GET | `/api/analysis/result/:analysisId` | Private | A single analysis by id (full issue detail) |
| GET | `/api/health` | Public | Health check |

\* `/callback` has no `protect` middleware (GitHub's redirect can't carry your
app's cookie/token), but it can't be used to act on an arbitrary account — the
signed, short-lived `state` param is the only thing that ties it to a user.

Private routes require a Bearer token (`Authorization: Bearer <token>`) or the
`token` httpOnly cookie set at login/register. Every `/api/analysis` and
`/api/github` route additionally checks that the resource (repository/
analysis) belongs to `req.user.id` — one user can never trigger or read
another user's analyses.

## Verification performed

**Part 1 (still passing):** register → duplicate-email rejection → login →
wrong-password rejection → protected route blocked without a token →
protected route succeeds with a token, no password leaked → logout → 404
handling.

**Part 2 (still passing):** ran 13 functional tests against the real Express
app, routes, controllers, and middleware — OAuth `state` correctly binds the
flow to the initiating user, tampered state is rejected, successful callback
saves the connection, **the GitHub access token never appears** in any API
response, repository listing/connect/disconnect all work and are scoped to
the requesting user.

**Part 3:** GitHub's and Gemini's APIs aren't reachable from this sandbox, so
outbound calls at those two service boundaries were stubbed; everything else
— routes, controllers, `analysisService`'s orchestration logic, the
`Analysis`/`Repository` Mongoose models, and the file-filtering rules — ran
as real code:
- **22 unit tests** on `fileFilters.isAnalyzablePath` (node_modules, .git,
  dist/build, .env variants, lockfiles, binaries, and unknown extensions are
  all correctly excluded; real source files across JS/TS/Python/Go/etc. are
  correctly included)
- A Mongoose schema-validation check confirming the `Analysis` model rejects
  invalid `severity`/`category` enum values and accepts a well-formed document
- **10 end-to-end pipeline tests**: unauthenticated run rejected (401); a full
  successful run correctly computes `overallScore` and severity counts from
  the issues Gemini returned, persists an `Analysis` document, and updates
  `Repository.lastAnalysis`/`lastAnalyzedAt`; `/latest`, `/history` (issue-free),
  and `/result/:id` (full detail) all return the right shape; a second user is
  correctly blocked (404) from another user's repository/analysis; a
  no-analyzable-files result and a Gemini failure both persist a `status:
  'failed'` `Analysis` record and surface the right error code (422 / 429)
  instead of crashing
- A **full-stack regression** chaining Part 1 → Part 2 → Part 3 together in one
  run (register → login → connect GitHub → list repos → connect a repo → run
  analysis → verify the repository listing now reflects `hasAnalysis` and the
  new `repositoryId` field) to confirm nothing in the earlier parts broke
- Frontend: clean `vite build` and a `vite preview` smoke test after each
  change

## Security notes

**Part 2:**
- The GitHub **client secret** never leaves `server/.env` — used only in the
  server-to-server token exchange call.
- The GitHub **access token** is stored with `select: false` and stripped
  again in `toJSON` as defense in depth — it never appears in any API response.
- Every GitHub-data route requires `protect`, and lookups are scoped to
  `req.user.id`.
- GitHub API errors map to proper status codes, including a dedicated **429**
  for rate limits (via `X-RateLimit-Remaining: 0`).
- Only repository *metadata* is persisted — never repository contents/code.

**Part 3:**
- The **Gemini API key** never leaves `server/.env` / the `geminiService`
  module — it's not returned in any response and isn't exposed to the client.
- Every `/api/analysis` route requires `protect`, and `analysisService`
  re-verifies repository ownership (`Repository.findOne({ _id, user })`)
  before touching GitHub or Gemini on the user's behalf — one user cannot
  trigger analysis on, or read the results of, another user's repository.
- Source fetching is capped (40 files / 40KB per file / 150K total
  characters) so a large or malicious repository can't blow up token usage
  or request time.
- `.env`, lockfiles, and binaries are excluded before anything is ever read
  from GitHub — secrets in a `.env` file are never sent to Gemini.
- The Gemini system instruction explicitly tells the model to treat file
  contents as untrusted data, not instructions, to reduce prompt-injection
  risk from adversarial repository content.
- Gemini's output is constrained by a JSON `responseSchema` and then
  re-validated/normalized server-side (severity and category are checked
  against fixed enums, `file` must be one of the paths actually sent, and
  string fields are length-capped) before anything reaches MongoDB.
- Gemini and GitHub API failures are caught, translated into proper HTTP
  status codes (429 for rate limits, 422 for "no analyzable files", 502 for
  upstream failures), and persisted as a `status: 'failed'` `Analysis`
  record rather than left unrecorded or crashing the request.

## What's intentionally not built yet

- Redis, BullMQ, or any background job queue — analysis runs synchronously
  within the request (fine for the file/size caps in place, but a real queue
  would be the next step for larger repositories)
- Docker
- Pull request review
- A cross-repository "Issues" aggregation view and a repository-independent
  "Analyses" history page (both still placeholders in the dashboard nav —
  per-repository history is available via `GET /api/analysis/:repositoryId/history`
  and the "View last analysis" link on each repository card)

These will be added in later parts without needing to restructure what's here.

## Deploying to Vercel (single project, frontend + backend)

This repo includes a root-level `vercel.json` and `api/index.js` so the whole
app deploys as **one Vercel project**: the React app builds as static output,
and the Express API runs as a single serverless function. Nothing in
`server/src` was changed to make this work — `api/index.js` just wraps the
existing app.

### What was added for this

- **`vercel.json`** (repo root) — builds `client`, serves `client/dist` as
  static output, and routes `/api/*` to the serverless function; everything
  else falls back to `index.html` for React Router.
- **`api/index.js`** (repo root) — the actual Vercel Function. It imports the
  unmodified `server/src/app.js` and calls it per-request.
- **`server/src/config/db.js`** — updated to cache the MongoDB connection
  promise at module scope instead of opening a new connection every call, and
  to `throw` on failure instead of `process.exit(1)` (a serverless function
  should never call `process.exit`). `server/server.js` (used for local `npm
  run dev`) now does its own `try/catch` around `connectDB()` and exits itself
  if the DB is unreachable, so local behavior is unchanged.

### 1. MongoDB Atlas network access

Vercel Functions don't have a fixed IP, so in Atlas: **Network Access → Add IP
Address → Allow Access from Anywhere (0.0.0.0/0)**. (If you need tighter
access control, use Atlas's Vercel integration instead of a raw IP allowlist.)

### 2. Push this repo to GitHub, then import it in Vercel

Vercel → **Add New → Project** → import the repo. Leave the **Root
Directory** as the repo root (not `client` or `server`) — `vercel.json` at
the root handles both halves.

### 3. Set these environment variables in the Vercel project (Settings → Environment Variables)

```
NODE_ENV=production
MONGO_URI=your_atlas_connection_string
JWT_SECRET=a_long_random_secret
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_DAYS=7

# Set these to your actual Vercel URL once you have it (redeploy after setting)
CLIENT_URL=https://your-app.vercel.app
GITHUB_CALLBACK_URL=https://your-app.vercel.app/api/github/callback

GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Frontend build-time var - relative path works since both live on one domain
VITE_API_BASE_URL=/api
```

### 4. Update the GitHub OAuth App's callback URL

In GitHub → **Settings → Developer settings → OAuth Apps → your app**, set
**Authorization callback URL** to
`https://your-app.vercel.app/api/github/callback` (must exactly match
`GITHUB_CALLBACK_URL` above). You can keep a second, separate OAuth App for
local development if you don't want to keep flipping this back and forth.

### 5. Deploy, then redeploy once you know the real URL

The first deploy will get you a `*.vercel.app` URL. Put that exact URL into
`CLIENT_URL` / `GITHUB_CALLBACK_URL` / the GitHub OAuth App / `VITE_API_BASE_URL`
(if you prefer the absolute form) and redeploy so those env vars take effect
— environment variables are baked in at build/deploy time, not read live.

### Things worth knowing about this setup

- **Function duration:** `vercel.json` sets `maxDuration: 60` for the API
  function. Gemini analysis on a repo near the file cap can take a while; if
  you see `FUNCTION_INVOCATION_TIMEOUT` (504) on `/api/analysis/:id/run`,
  raise `maxDuration` (Hobby plans support up to 300s with Fluid Compute
  enabled, Pro up to 800s) or lower `MAX_FILES` in `githubService.js`.
- **Cold starts:** the first request after idle time will be slower (new
  MongoDB connection, GitHub/Gemini clients initialized). Subsequent requests
  on a warm function reuse the cached connection from the `db.js` change above.
- **Cookies now work same-origin:** since the frontend and API share one
  domain in this setup, the GitHub OAuth flow's httpOnly cookie no longer
  crosses origins the way it would with the frontend and backend on separate
  domains — no extra CORS/cookie configuration needed beyond what's already
  in `app.js`.
- **Local development is unaffected** — `npm run dev` in `server/` and
  `client/` still works exactly as in Parts 1-3; the Vercel deployment path
  (`api/index.js`) is a separate, additive entry point.
