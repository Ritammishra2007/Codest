# Codest

A local 1v1 Python programming platform built with React, Express, PostgreSQL, and Prisma. Players join a private room, solve the same problem, and submit Python solutions to a background judge.

## Run a fresh clone

Install these prerequisites on macOS, Windows, or Linux:

- Git
- Node.js 22 or newer, with npm (`.nvmrc` selects Node 22)
- Python 3, available on PATH (`python3`, `python`, or the Windows `py -3` launcher)
- Docker with Compose for the database, **or** your own running PostgreSQL database

Start Docker if you are using the provided database, then run:

```sh
git clone https://github.com/Ritammishra2007/Codest.git
cd Codest
npm run setup
npm run db:start
npm run db:setup
npm run dev
```

Open **http://localhost:5173**. The API listens at **http://127.0.0.1:5001/api**.

`setup` installs the locked backend and frontend dependencies creates their `.env` files, and explicitly generates Prisma Client (even when npm skips dependency install scripts). It generates a unique local JWT secret and preserves any existing `.env` files. `db:start` waits for PostgreSQL to become healthy; `db:setup` generates Prisma Client, applies the checked-in migrations, and seeds four problems without deleting existing data. `dev` starts both services; Ctrl+C stops them. Database storage persists in a Docker volume.

After subsequent pulls, run `npm run install:all` if dependency files changed. Run `npm run db:setup` after pulling new migrations. Developers creating schema changes should run `npx prisma migrate dev --name describe_change` from `backend/` against a development database and commit the resulting migration.

## Use your own PostgreSQL instead

Run `npm run setup`, create an empty database with your PostgreSQL tools, then edit `backend/.env`:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/YOUR_DATABASE"
```

URL-encode special characters in credentials. Skip `npm run db:start`; run `npm run db:setup` and `npm run dev`. The database user needs permission to create tables in this database. Setup never creates or starts a local PostgreSQL installation on your behalf.

## Configuration

| File | Purpose |
| --- | --- |
| `backend/.env` | Database connection, JWT secret, API port/host, frontend origin, optional Python path |
| `frontend/.env` | `VITE_API_URL`, the backend URL used by the browser |
| `compose.yaml` | Optional local PostgreSQL service, bound to loopback port 5433 |

For a custom Python installation, set `PYTHON_BIN` to the executable name or full path in `backend/.env`, without command-line arguments. On Windows, for example: `PYTHON_BIN="C:/Python313/python.exe"`.

If port 5433 is occupied, change the host port in `compose.yaml` and the matching port in `DATABASE_URL`. If API port 5001 changes, update `PORT` and `VITE_API_URL`. If frontend port 5173 changes, update `VITE_PORT` in `frontend/.env` and `FRONTEND_URL` in `backend/.env`. Restart both services after configuration changes.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install dependencies and create missing local environment files |
| `npm run install:all` | Reinstall both packages using their lockfiles |
| `npm run dev` | Start backend and frontend together |
| `npm run backend` / `npm run frontend` | Start either service separately |
| `npm run doctor` | Check Python and required environment configuration |
| `npm run db:start` / `npm run db:stop` | Start or stop the optional Docker database; retain data |
| `npm run db:status` | Show the Docker database status |
| `npm run generate` | Generate Prisma Client locally from the schema |
| `npm run db:migrate` | Apply committed database migrations |
| `npm run db:setup` | Generate Prisma Client, apply migrations, and seed missing problems |
| `npm run db:seed` | Add missing seed problems |
| `npm run db:reset` | **Delete all application data**, then reseed problems |
| `npm run studio` | Open Prisma's database browser |
| `npm run build` | Build frontend into `frontend/dist` |
| `npm run test:runner` | Run Python judge tests without PostgreSQL |
| `npm test` | Run integration checks against a running backend and seeded test database |

Integration checks create test users and duels. Use a disposable test database. `TEST_API_URL` can override the endpoint used by the test suite.

## Why there are three package.json files

- Root `package.json`: shared setup and development commands; no application dependencies.
- `backend/package.json`: Express, Prisma, authentication, and backend commands.
- `frontend/package.json`: React, Vite, styling, and frontend commands.

All three belong in Git. The two `package-lock.json` files also belong in Git so `npm ci` installs the same dependency versions. Generated `node_modules/`, `.vite/`, `dist/`, private `.env` files, and local database files are ignored. Commit `.env.example` templates only.

## Project layout

```text
backend/
  config/         Environment, Prisma, and Python configuration
  controllers/    Authentication, room, and submission handlers
  middleware/     JWT authentication
  prisma/         Schema, committed migrations, seed, and reset scripts
  routes/         API routes
  services/       Python runner and judging queue
  test/           Runner and integration checks
  server.js       Backend entry point
frontend/src/     React pages, components, authentication state, and API client
scripts/          Cross-platform setup and development launcher
docs/api_contract.md
compose.yaml      Optional local PostgreSQL
```

## Play locally

Open two browser sessions, register two users, create a room in one session, and join with its code in the other. The problem appears when both players have joined. The first accepted solution wins.

The Python runner executes submitted code as a local child process with time and output limits; it is **not a security sandbox**. Use this setup for local development with trusted users and code. A public deployment requires an isolated execution service.

## Prisma Client and existing databases

Prisma Client is generated for each laptop under `backend/node_modules/.prisma/client`. It is intentionally ignored by Git. `npm run setup` and `npm run install:all` now generate it explicitly. If you installed dependencies manually, run `npm run generate` from the repository root before starting the backend.

Database migrations are source files and are committed under `backend/prisma/migrations/`.

If you previously initialized this same schema with `prisma db push`, Prisma may report P3005 because the database contains tables but has no migration history. Do not reset a database containing data you need. Back it up and compare its schema with `backend/prisma/schema.prisma` first. Only if it matches the initial migration, mark that migration as already applied, from `backend/`:

```sh
npx prisma migrate resolve --applied 20261121000000_init
```

Then run `npm run db:setup` from the root. Fresh, empty databases do not need this baseline step.
