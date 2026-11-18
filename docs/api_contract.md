# Codest API Specification & Contract

This document defines the REST API contract between the frontend and the Express backend.

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Creates a new user account.
- **Request Body:**
  ```json
  {
    "username": "alice",
    "email": "alice@codest.local",
    "password": "securepassword123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "token": "jwt_token_string",
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@codest.local",
      "created_at": "2026-11-20T17:00:00.000Z"
    }
  }
  ```
- **Error (400 Bad Request / 409 Conflict):**
  ```json
  {
    "success": false,
    "message": "Username or email already in use"
  }
  ```

---

### `POST /api/auth/login`
Authenticates an existing user.
- **Request Body:**
  ```json
  {
    "usernameOrEmail": "alice",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "jwt_token_string",
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@codest.local"
    }
  }
  ```

---

### `GET /api/auth/me`
Fetches the currently authenticated user session.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@codest.local"
    }
  }
  ```

---

## 2. Room Endpoints

### `POST /api/rooms`
Creates a new private duel room.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Behavior:**
  1. Randomly picks an active problem from `problems`.
  2. Generates an uppercase 6-character room code.
  3. Inserts into `rooms` with `player1_id = req.user.id`, `status = 'WAITING'`, `next_submission_sequence = 1`.
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "room": {
      "id": 10,
      "code": "A9X2K1",
      "player1_id": 1,
      "player2_id": null,
      "status": "WAITING",
      "winner_id": null,
      "created_at": "2026-11-20T17:00:00.000Z"
    }
  }
  ```
  *(Note: `problem` object is omitted while `WAITING`)*

---

### `POST /api/rooms/join`
Second player joins the room using the code.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Request Body:**
  ```json
  {
    "code": "A9X2K1"
  }
  ```
- **Behavior (Atomic Transaction):**
  1. Checks room exists, is `WAITING`, and `player1_id != req.user.id`.
  2. Updates `player2_id = req.user.id`, `status = 'ACTIVE'`, `started_at = NOW()`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "room": { ... }
  }
  ```

---

### `GET /api/rooms/:code`
Retrieves room state.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Access Rule:** Only `player1` or `player2` can access.
- **Privacy Rule:** If `status == 'WAITING'`, the `problem` field is null and problem ID is omitted. If `ACTIVE` or `FINISHED`, the problem statement and visible sample test cases are included. Hidden edge-case tests are never returned.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "room": {
      "id": 10,
      "code": "A9X2K1",
      "player1_id": 1,
      "player2_id": 2,
      "player1_username": "alice",
      "player2_username": "bob",
      "status": "ACTIVE",
      "winner_id": null,
      "started_at": "2026-11-20T17:05:00.000Z",
      "ended_at": null,
      "problem": {
        "id": 1,
        "title": "Two Sum Problem",
        "description": "...",
        "input_format": "...",
        "output_format": "...",
        "constraints_text": "...",
        "difficulty": "EASY",
        "time_limit_ms": 2000,
        "samples": [
          { "position": 1, "input": "2 7 11 15\n9", "expected_output": "0 1" }
        ]
      }
    }
  }
  ```

---

### `GET /api/rooms/my-rooms`
Returns all rooms where the logged-in user is `player1` or `player2`.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "rooms": [ ... ]
  }
  ```

---

## 3. Submission Endpoints

### `POST /api/rooms/:roomId/submissions`
Submits a Python solution for judging.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Request Body:**
  ```json
  {
    "sourceCode": "import sys\n# code..."
  }
  ```
- **Concurrency & Validation Rules:**
  1. Room must be `ACTIVE`.
  2. User must be a room member (`player1` or `player2`).
  3. User cannot have another submission with status `PENDING` or `RUNNING` in this room.
  4. In a transaction: allocate room's `next_submission_sequence`, increment it, insert submission with `status = 'PENDING'`, `verdict = null`.
- **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Submission received and queued for judging",
    "submissionId": 45,
    "sequenceNumber": 1
  }
  ```

---

### `GET /api/rooms/:roomId/my-submissions`
Fetches only the logged-in user's submission history for that room.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "submissions": [
      {
        "id": 45,
        "sequence_number": 1,
        "status": "DONE",
        "verdict": "ACCEPTED",
        "submitted_at": "2026-11-20T17:10:00.000Z",
        "judged_at": "2026-11-20T17:10:02.000Z"
      }
    ]
  }
  ```
  *(Note: Opponent's source code or submission history is never disclosed).*
