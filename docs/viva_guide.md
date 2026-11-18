# Codest — DBMS & Capstone Viva Examination Guide

This guide is prepared to help you confidently explain the architecture, database normalization, concurrency decisions, and execution workflows of **Codest** during your semester capstone and DBMS viva.

---

## 1. High-Level Project Elevator Pitch

> *"Codest is a 1v1 Python competitive programming platform. Two users join a private room to solve an identical algorithmic problem. The first submission in server-assigned sequence order that passes all test cases wins. The platform uses Express.js, PostgreSQL with Prisma, and a React frontend, with background local Python execution and polling."*

---

## 2. Database Normalization (1NF, 2NF, 3NF)

Your project has **exactly 5 tables**: `users`, `problems`, `test_cases`, `rooms`, `submissions`. Here is how they satisfy normalization rules:

### A. First Normal Form (1NF)
- **Rule**: Every column must contain atomic (indivisible) values, and each record must be unique.
- **In Codest**:
  - Each table has a primary key (`id`).
  - No repeating groups or comma-separated lists. For example, test cases are stored in their own `test_cases` table instead of being packed into an array column inside `problems`.

### B. Second Normal Form (2NF)
- **Rule**: Satisfies 1NF, and all non-key attributes must be fully functionally dependent on the entire primary key (no partial dependencies).
- **In Codest**:
  - In `test_cases`, the composite candidate key is `(problem_id, position)`. All attributes (`input`, `expected_output`, `is_sample`) depend on both the problem and the specific position.
  - In `submissions`, each submission has a single surrogate key `id` and an alternate key `(room_id, sequence_number)`. All attributes (`source_code`, `status`, `verdict`) depend on that submission.

### C. Third Normal Form (3NF)
- **Rule**: Satisfies 2NF, and there must be no transitive dependencies (non-key columns depending on other non-key columns: $X \to Y \to Z$).
- **In Codest**:
  - `rooms` stores `problem_id`, `player1_id`, and `player2_id`. It does **not** store the problem title, user email, or usernames. To show the username, we join with `users`.
  - `submissions` stores `user_id` and `room_id`. It does not store user details or room codes.
  - The winner is stored as a foreign key `winner_id` pointing to `users(id)`.

---

## 3. Concurrency & Race Condition Handling

Interviewers love to ask: *"What happens if two players submit at the exact same millisecond or try to join the second slot simultaneously?"*

### Question 1: How do you prevent two users from claiming Player 2?
**Answer**:
> *"We perform an atomic conditional update directly in PostgreSQL:*
> ```sql
> UPDATE rooms
> SET player2_id = $new_user_id, status = 'ACTIVE', started_at = NOW()
> WHERE code = $code AND status = 'WAITING' AND player2_id IS NULL;
> ```
> *PostgreSQL applies row-level locking on the room row. If two users request to join at the exact same millisecond, the first transaction updates the row and sets `player2_id`. The second transaction checks `WHERE player2_id IS NULL`, finds 0 matching rows, and is immediately rejected with an HTTP 409 conflict."*

---

### Question 2: Why not use client timestamps to pick the winner?
**Answer**:
> *"Client system clocks can be altered, out of sync, or delayed by network latency. Using client timestamps would allow a player with a manipulated clock to claim victory. Instead, the backend defines the single source of truth by assigning an incremental `sequence_number` per room inside an ACID database transaction."*

---

### Question 3: How is sequence order allocated safely?
**Answer**:
> *"Inside a Prisma `$transaction`, we read the room's `next_submission_sequence`, assign it to the new submission, and increment `next_submission_sequence` on the room record in the same atomic operation:*
> ```javascript
> const result = await prisma.$transaction(async (tx) => {
>   const room = await tx.room.findUnique({ where: { id: roomId } });
>   const sequenceNumber = room.nextSubmissionSequence;
>   await tx.room.update({
>     where: { id: roomId },
>     data: { nextSubmissionSequence: sequenceNumber + 1 }
>   });
>   return await tx.submission.create({
>     data: { roomId, userId, sequenceNumber, sourceCode, status: 'PENDING' }
>   });
> });
> ```
> *This ensures no two submissions in the same room can ever share the same sequence number."*

---

## 4. Execution & Judging Workflow

### Question 4: Why does `POST /api/rooms/:roomId/submissions` return HTTP 202 Accepted?
**Answer**:
> *"Judging code takes time (compiling, running multiple test cases, evaluating limits). Keeping an HTTP request open while running Python scripts can cause gateway timeouts, thread starvation, and poor user experience. HTTP 202 Accepted confirms that the submission has been successfully received, validated, and placed in the queue. The frontend then polls for updates."*

---

### Question 5: How does the judging queue maintain sequential fairness?
**Answer**:
> *"The background worker processes submissions room-by-room in `sequence_number ASC` order:*
> 1. *It queries for the earliest `PENDING` submission in each active room.*
> 2. *It sets status to `RUNNING` and executes the code against test cases in position order.*
> 3. *If that submission passes all test cases, it is marked `ACCEPTED`, the room is marked `FINISHED`, and any remaining pending submissions in that room are marked `CANCELLED`.*
> 4. *An earlier unresolved submission cannot be overtaken by a later submission."*

---

### Question 6: How does the local Python runner work?
**Answer**:
> *"We use Node's `child_process.spawn('python3', [filePath])`:*
> - *A unique temporary directory is created for the execution.*
> - *The source code is written to `solution.py`.*
> - *The test input is written to standard input (`stdin`).*
> - *A wall-clock timeout (`setTimeout`) kills the process (`SIGKILL`) if execution time exceeds `time_limit_ms` (yielding `TIME_LIMIT_EXCEEDED`).*
> - *The output buffer is capped at 256 KB to prevent memory exhaustion (yielding `OUTPUT_LIMIT_EXCEEDED`).*
> - *Output is tokenized by whitespace and compared against expected test output.*
> - *The temporary directory is deleted in a `finally` block."*

---

## 5. Security & Privacy Decisions

### Question 7: How do you prevent players from seeing problem details before the duel begins?
**Answer**:
> *"While a room is in `WAITING` status, the backend endpoint `GET /api/rooms/:code` strictly sets `problem: null` and omits the `problem_id`. Even if a user inspects browser network logs, the problem statement is never sent over the wire until Player 2 has joined."*

### Question 8: Are hidden test cases exposed to the frontend?
**Answer**:
> *"No. The Prisma query in `roomController.js` includes a filter: `where: { isSample: true }`. Hidden edge test cases remain on the server and are never included in API responses."*

---

## 6. Crash Recovery Procedure

### Question 9: What happens if the server crashes while a submission is running?
**Answer**:
> *"On startup, the server runs `recoverInterruptedSubmissions()`. It queries PostgreSQL for any submission with status `RUNNING` and resets it to `PENDING`. When the background judging loop starts, it picks up those submissions and re-executes them from test case 1 with their original `sequence_number`, so no player loses their place in queue."*

---

## 7. Quick Summary of Tech Stack Choices

| Component | Choice | Reason |
|---|---|---|
| **Backend** | Node.js + Express | Lightweight, simple asynchronous I/O, native child processes |
| **Database** | PostgreSQL | Robust ACID transactions, row-level locking, foreign key integrity |
| **ORM** | Prisma | Direct mapping to exact database tables, type safety, straightforward queries |
| **Frontend** | React + Vite + Tailwind CSS | Fast rendering, modular page components, clean Codeforces-inspired minimalist styling |
| **Auth** | JWT + bcrypt | Stateless authentication; passwords hashed with salt rounds = 10 |
| **Communication** | REST + Polling | Simpler and more resilient than WebSockets for our capstone scope; handles network disconnects cleanly |
