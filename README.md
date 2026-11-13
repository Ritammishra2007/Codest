# Codest

> A 1v1 competitive programming platform for Python developers.

Codest allows two programmers to join a private room and duel on the same algorithmic problem. Submissions are judged in real-time against seeded test cases (including hidden edge cases), and the first player to submit a solution that passes all test cases wins.

---

## Features

- **Private 1v1 Rooms**: Create rooms and share simple 6-character room codes.
- **Fair Start**: The problem statement is strictly hidden until Player 2 joins so neither player gets an early advantage.
- **Real-Time Python Runner**: Runs Python 3 code in isolated child processes with input/output piping, execution timeouts (TLE detection), and memory/output limits.
- **Strict Server-Assigned Order**: Winner determination is based on the server's sequence order, preventing client clock manipulation.
- **Submission History**: Live status updates for submissions (`ACCEPTED`, `WRONG_ANSWER`, `SYNTAX_ERROR`, `TIME_LIMIT_EXCEEDED`).
- **Autosaved Drafts**: Editor state is automatically saved to local storage so refreshes never lose your progress.
- **Clean Interface**: Focused, distraction-free UI inspired by competitive programming platforms with a plain monospace code editor and split-pane layout.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Router v7
- **Backend**: Node.js (ES Modules), Express
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing
- **Execution Engine**: Local Python 3 runner with `child_process.spawn`

---

## Project Structure

```
├── backend/
│   ├── config/             # Database and Prisma connection
│   ├── controllers/        # Request handlers (auth, rooms, submissions)
│   ├── middleware/         # Auth verification middleware
│   ├── prisma/             # Schema definitions and problem seed data
│   ├── routes/             # Express API route declarations
│   ├── services/           # Python runner and judging queue worker
│   ├── test/               # Integration verification suite
│   ├── server.js           # Server entry point
│   ├── .env.example        # Environment variable template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable layout and header components
│   │   ├── context/        # Authentication context
│   │   ├── pages/          # Login, Register, Dashboard, Room screens
│   │   ├── services/       # API client functions
│   │   ├── App.jsx         # Routes and route guards
│   │   └── main.jsx        # Frontend entry point
│   ├── .env.example        # Frontend API URL configuration
│   ├── index.html
│   └── package.json
│
├── docs/
│   ├── api_contract.md     # Detailed API endpoints specification
│   └── viva_guide.md       # Architecture & DBMS exam reference notes
│
├── .gitignore
├── package.json            # Root workspace scripts
└── README.md
```

---

## Database Design

The database schema consists of 5 normalized tables:

1. **`users`**: User credentials (`id`, `username`, `email`, `password_hash`, `created_at`).
2. **`problems`**: Algorithmic problems (`id`, `title`, `description`, `input_format`, `output_format`, `constraints_text`, `difficulty`, `time_limit_ms`).
3. **`test_cases`**: Test cases (`id`, `problem_id`, `input`, `expected_output`, `is_sample`, `position`). Visible samples are exposed to players, while hidden tests remain server-side.
4. **`rooms`**: Duel sessions (`id`, `code`, `problem_id`, `player1_id`, `player2_id`, `status`, `winner_id`, `started_at`, `ended_at`, `next_submission_sequence`).
5. **`submissions`**: Code attempts (`id`, `room_id`, `user_id`, `sequence_number`, `source_code`, `status`, `verdict`, `submitted_at`, `judged_at`).

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)
- [Python 3](https://www.python.org/) (available as `python3` in your terminal)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/codest.git
cd codest
```

---

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```bash
cp backend/.env.example backend/.env
```
Fill in your database URL and JWT secret:
```env
PORT=5001
DATABASE_URL="postgresql://postgres:password@localhost:5432/codest_db"
JWT_SECRET="your_custom_jwt_secret_here"
```

**Frontend (`frontend/.env`):**
```bash
cp frontend/.env.example frontend/.env
```
```env
VITE_API_URL=http://localhost:5001/api
```

---

### 3. Install Dependencies

Install root, backend, and frontend packages:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
cd ..
```

---

### 4. Database Setup & Seeding

Sync the Prisma schema to your PostgreSQL database and seed the initial problem catalog:

```bash
# From backend directory
cd backend
npx prisma db push
node prisma/seed.js
cd ..
```

---

### 5. Running the Application

You can start the backend and frontend in two separate terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
*(Runs the server on `http://localhost:5001` and starts the judging worker)*

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
*(Runs Vite on `http://localhost:5173`)*

Or run directly from the project root using the provided npm scripts:
```bash
# Start backend
npm run backend

# In another terminal, start frontend
npm run frontend
```

---

## How to Play

1. Open `http://localhost:5173` in two browser windows (e.g. one standard window and one private/incognito window).
2. Register two accounts (e.g. `alice` and `bob`).
3. As **Player 1**: Click **+ Create New Room** on the Dashboard. Copy the generated 6-character room code.
4. As **Player 2**: Paste the room code into the **Join Room** input on the Dashboard and click **Join Room**.
5. The room changes to `ACTIVE` and reveals the problem to both players at the same time.
6. Write your Python 3 code in the editor and click **Submit Solution**.
7. The first player to submit a passing solution wins the match!

---

## API Overview

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/login` | Log in and receive JWT token |
| `GET` | `/api/auth/me` | Get current logged-in user session |
| `POST` | `/api/rooms` | Create a new private duel room |
| `POST` | `/api/rooms/join` | Join room via 6-character code |
| `GET` | `/api/rooms/:code` | Fetch room details and problem |
| `GET` | `/api/rooms/my-rooms` | List rooms created or joined by user |
| `POST` | `/api/rooms/:roomId/submissions` | Submit code for judging (HTTP 202) |
| `GET` | `/api/rooms/:roomId/my-submissions` | List your submissions for the room |

---

## Contributing & License

This project was built for educational and portfolio purposes. Feel free to fork, customize, or submit pull requests!

Licensed under the [MIT License](LICENSE).
