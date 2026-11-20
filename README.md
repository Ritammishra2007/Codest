# Codest

A local 1v1 Python programming platform built with React, Express, PostgreSQL, and Prisma.

## Requirements

Install Node.js 22 or newer, Python 3, Git, and PostgreSQL. Start PostgreSQL using your installed application's controls or service manager. The commands below use PostgreSQL directly.

## First-time setup on a Mac

```sh
git clone https://github.com/Ritammishra2007/Codest.git
cd Codest
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Copy the environment files only on a fresh clone. If they already exist, keep them.

Create an empty database using your PostgreSQL GUI, or run this with your actual PostgreSQL username and port:

```sh
createdb -h 127.0.0.1 -p 5432 -U YOUR_USER codest_db
```

Edit `backend/.env` to match your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/codest_db"
```

Use your actual port if it is not 5432. URL-encode special characters in the username or password. If your local PostgreSQL user does not require a password, use `postgresql://YOUR_USER@127.0.0.1:5432/codest_db`.

Generate a secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste its output into `JWT_SECRET` in `backend/.env`. Then run:

```sh
npm run setup
npm run db:setup
```

`setup` runs ordinary npm commands to install both apps from their lockfiles and generate Prisma Client. `db:setup` applies the committed migrations and seeds four problems. Neither command starts PostgreSQL or overwrites your environment files.

## Start the app

Open two terminals in the project root.

Terminal 1 — backend:

```sh
npm run backend
```

Terminal 2 — frontend:

```sh
npm run frontend
```

Open **http://localhost:5173**. The API runs at **http://127.0.0.1:5001/api**. Stop each server with Ctrl+C. `npm run dev` is an alias for starting **only the backend**.

You can also run `npm run dev` inside `backend/` or `frontend/` to start that app directly. Backend startup automatically generates Prisma Client.

## Commands

Run these from the project root:

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install both apps and generate Prisma Client |
| `npm run generate` | Generate Prisma Client only |
| `npm run db:setup` | Generate client, apply migrations, and seed problems |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:seed` | Add missing seed problems |
| `npm run db:reset` | **Delete application data**, then reseed |
| `npm run studio` | Open Prisma's database browser |
| `npm run backend` | Start the backend |
| `npm run frontend` | Start the frontend |
| `npm run build` | Build frontend into `frontend/dist` |
| `npm run test:runner` | Test Python judging without PostgreSQL |
| `npm test` | Run integration checks against the running backend and a seeded test database |

Integration checks create test users and duels. Use a disposable test database. `TEST_API_URL` overrides the test API endpoint.

After pulling dependency updates, run `npm run setup` again. After pulling migrations, run `npm run db:setup`.

## Configuration and troubleshooting

- Set `PYTHON_BIN` in `backend/.env` if Python 3 is not on PATH. Use an executable name or full path without arguments.
- If API port 5001 changes, update `PORT` in `backend/.env` and `VITE_API_URL` in `frontend/.env`.
- If frontend port 5173 changes, update `VITE_PORT` in `frontend/.env` and `FRONTEND_URL` in `backend/.env`.
- If Prisma Client is missing, run `npm run generate`.
- If PostgreSQL cannot be reached, confirm it is running and check `DATABASE_URL`.

The same npm commands work on Windows and Linux. On Windows, copy the `.env.example` files using Explorer or PowerShell `Copy-Item` instead of `cp` if needed. Python detection supports the Windows `py -3` launcher.

## Existing databases and migrations

Migrations are tracked in `backend/prisma/migrations/`. Prisma Client is generated locally in `backend/node_modules/.prisma/client` and is not committed.

If a database was previously initialized with `prisma db push`, migration setup may report P3005. Do not reset a database containing data you need. Back it up and compare its schema against the initial migration. Only if they match, run this from `backend/`:

```sh
npx prisma migrate resolve --applied 20261121000000_init
```

Then run `npm run db:setup` from the root. Empty databases do not need this step.

For new schema changes, run `npx prisma migrate dev --name describe_change` from `backend/` against a development database, and commit the generated migration.

## Project files

The root `package.json` provides command shortcuts. `backend/package.json` and `frontend/package.json` define their respective dependencies. Keep all three and both lockfiles in Git. Generated dependencies, builds, caches, local database files, and private `.env` files are ignored.

API details are in `docs/api_contract.md`.

The Python runner executes submitted code as a local child process with time and output limits; it is not a security sandbox. Use this setup with trusted users and code. Public deployment requires an isolated execution service.
