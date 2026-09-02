# SBG-Website

The official portal for the Student Body Government (SBG) of DAU. Far beyond a simple slot booking system, this platform serves as the central hub for campus life. It streamlines everything from venue reservations and real-time master schedules, to comprehensive club membership management, post-event reporting, and automated administrative workflows. Designed to eliminate email chains and double-bookings, it empowers clubs to operate efficiently while giving administrators total visibility and control.

## Features

### Clubs
- **Global schedule** — see every approved booking across all venues at a glance
- **Slot booking** — request a venue with automatic conflict detection
- **Booking management** — track request status, edit pending bookings, submit post-event reports
- **Policy reference** — in-app access to booking rules and guidelines

### Administrators
- **Dashboard** — pending request count, approval stats, and quick actions
- **Request workflow** — review, approve, or reject bookings with optional email notifications
- **Master schedule** — filterable calendar view of all venues

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | NeonDB (Serverless PostgreSQL) |
| **Notifications** | EmailJS (optional) |
| **Deployment** | Docker (single container), GHCR, GitHub Actions |

## Prerequisites

- **Node.js** v22+
- **npm**
- A [Neon](https://neon.tech) database project

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sbg-siddh-coder/SBG-Website.git
cd SBG-Website
```

### 2. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 3. Configure environment variables

Copy the example files and fill in your values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**`server/.env`**
```env
DATABASE_URL="postgresql://..."
PORT=4000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173,http://localhost:3005"
JWT_SECRET="local-dev-secret"
```

**`client/.env`**
```env
# Leave empty to use the Vite proxy (/api → http://localhost:4000).
VITE_API_URL=
```

### 4. Run Database Migrations

Set up the database schema in Neon (ensure your `DATABASE_URL` is set in `server/.env`):

```bash
cd server
npm run migrate
```

### 5. Start development servers

```bash
# Terminal 1 — API server (localhost:4000)
cd server
npm run dev

# Terminal 2 — Frontend (localhost:5173)
cd client
npm run dev
```

### Docker (optional)

Compose files live in `docker-compose/`. Paths inside them are relative to that directory, so always pass `-f` from the repo root.

```bash
cp server/.env.example server/.env   # set DATABASE_URL and JWT_SECRET

# Dev: Vite on :5173, API on :4000, hot reload
docker compose -f docker-compose/docker-compose.dev.yml up --build

# Production-like: one container, Express serves the SPA on :3005
docker compose -f docker-compose/docker-compose.yml up --build
```

## Project Structure

```
SBG-Website/
├── client/                  # React frontend (built into the app image)
│   ├── src/
│   │   ├── components/ui/   # shadcn/ui primitives
│   │   ├── pages/           # Route-level pages
│   │   ├── App.tsx          # Router & layout
│   │   └── types.ts         # Shared TypeScript types
│   └── vite.config.ts
│
├── server/                  # Express API (serves the SPA in production)
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth & request middleware
│   │   ├── server.ts        # Entry point
│   │   └── db.ts            # NeonDB (PostgreSQL) connection pool
│   └── migrations/          # SQL schema migrations
│
├── docker-compose/          # Compose files (paths relative to this folder)
│   ├── docker-compose.yml       # Local production-like build
│   ├── docker-compose.dev.yml   # Local Vite + API
│   └── docker-compose.prod.yml  # VPS: pull image from GHCR
├── Dockerfile               # Production image (client + server)
├── docker-entrypoint.sh
└── .github/workflows/       # Typecheck, image build/push, SSH deploy
```

## Production Deployment

Production is a **single Docker container**: Express serves the API and the built SPA. GitHub Actions typechecks, builds the image, pushes it to GHCR, then SSHs to the VPS to pull and restart.

### First-time VPS setup

Install Docker Engine and the Compose plugin. Create the deploy directory and a secrets file (never commit this):

```bash
sudo mkdir -p /opt/sbg-website
sudo cp .env.example /opt/sbg-website/.env   # or copy from this repo
sudo nano /opt/sbg-website/.env
```

Required values in `/opt/sbg-website/.env`:
- `DATABASE_URL` — production PostgreSQL connection string
- `JWT_SECRET` — long random string used to sign auth tokens
- `NODE_ENV=production`
- `CORS_ORIGIN` — live site origin, e.g. `https://sbg.dau.ac.in`
- `PORT=3005` (inside the container; do not change unless you also change compose)

The app is published on `127.0.0.1:3005` by default. Put Nginx or Apache in front for HTTPS and proxy to that address.

Log the VPS into GHCR so it can pull the private/public image (a PAT or `GHCR_PULL_TOKEN` used by Actions):

```bash
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

GitHub Actions copies `docker-compose/docker-compose.prod.yml` to `/opt/sbg-website/docker-compose.prod.yml` (flattened, so `.env` stays next to it). After the first successful deploy:

```
/opt/sbg-website/
  .env
  docker-compose.prod.yml
```

### CI/CD secrets

Configure these on the GitHub repo (production environment):

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | VPS hostname or IP |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private key for that user |
| `DEPLOY_PATH` | Optional; defaults to `/opt/sbg-website` |
| `DEPLOY_PORT` | Optional; defaults to `22` |
| `GHCR_PULL_TOKEN` | Optional; PAT with `read:packages` if the image is private |

If `DEPLOY_HOST` is unset, the workflow still builds and pushes the image, then skips SSH deploy.

### Manual deploy on the VPS

```bash
cd /opt/sbg-website
export APP_IMAGE=ghcr.io/<owner>/sbg-website:<sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

## Contributing

Contributions are welcome! This project uses **[Conventional Commits](https://www.conventionalcommits.org/)** and **automated versioning** — no manual version bumps needed.

### Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes (individual commit messages do not need to be strictly formatted)
4. Push to your branch (`git push origin feat/my-feature`)
5. Open a Pull Request. **Important:** CI will validate your **Pull Request Title** (not individual commits) to ensure it follows the Conventional Commits format. 
6. When your PR is approved, it must be merged using **Squash and Merge**.

### Pull Request Title Format

Your **Pull Request Title** (and the resulting squashed commit) must follow this format:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

**Types and their effect on versioning:**

| Type | Description | Version Bump |
|------|-------------|-------------|
| `feat` | New feature | **Minor** (1.x.0) |
| `fix` | Bug fix | **Patch** (1.0.x) |
| `docs` | Documentation only | None |
| `style` | Formatting, whitespace | None |
| `refactor` | Code restructuring | None |
| `perf` | Performance improvement | None |
| `test` | Adding/updating tests | None |
| `build` | Build system changes | None |
| `ci` | CI configuration | None |
| `chore` | Maintenance tasks | None |
| `revert` | Reverts a previous commit | None |

**Breaking changes** → **Major** bump (x.0.0): add `!` after the type or include a `BREAKING CHANGE:` footer.

**Examples:**
```bash
git commit -m "feat: add real-time booking notifications"
git commit -m "fix: prevent double-booking on concurrent requests"
git commit -m "feat(admin)!: redesign dashboard API endpoints"
git commit -m "docs: update deployment instructions"
```

### How Auto-Versioning Works

1. You create a PR with a `feat:` / `fix:` prefix in the **PR Title**.
2. CI validates the PR Title automatically.
3. Upon **Squash and Merge** into `main`, [release-please](https://github.com/googleapis/release-please) (running only on the upstream `ossdaiict` repository) opens a **Release PR** with the bumped version and updated CHANGELOG.
4. When the Release PR is merged, a GitHub Release and git tag are created automatically.
5. CI builds and deploys the Docker image to production. *(Note: Image builds, versioning, and deployments are restricted to the official repository and will not run on personal forks).*

*Note: By contributing to this repository, you agree that your contributions will be licensed under its proprietary license.*

## Contributors

A huge thank you to everyone who has contributed to this project:

[![Contributors](https://contrib.rocks/image?repo=sbg-siddh-coder/SBG-Website)](https://github.com/sbg-siddh-coder/SBG-Website/graphs/contributors)

## License

**Proprietary and Confidential.**

This repository and its contents are proprietary to the Student Body Government (SBG), DAU. The source code is made publicly available for the sole purpose of transparency, portfolio demonstration, and peer review. No license is granted for any use, modification, distribution, or reproduction.

See the [LICENSE](LICENSE) file for the full legal text.
