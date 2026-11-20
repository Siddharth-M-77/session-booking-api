# Teacher-User Session Booking Platform REST API

A production-quality REST API built with Node.js, TypeScript, Express, MongoDB, and Mongoose that enables users to book one-on-one sessions with teachers, view daily session availability, and track their upcoming and completed session histories.

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Setup & Running Locally](#setup--running-locally)
- [Environment Variables](#environment-variables)
- [Architecture & Design Decisions](#architecture--design-decisions)
  - [Prevention of Double Booking & Race Conditions](#prevention-of-double-booking--race-conditions)
  - [MongoDB Aggregation Pipelines](#mongodb-aggregation-pipelines)
  - [Centralized Error Handling](#centralized-error-handling)
  - [Assumptions](#assumptions)
- [API Documentation](#api-documentation)
- [Postman Collection](#postman-collection)
- [Available Scripts](#available-scripts)

---

## Tech Stack
- **Runtime & Language**: Node.js (v18+ LTS / v20+ / v22+), TypeScript (Strict Mode enabled)
- **Framework**: Express.js
- **Database & ODM**: MongoDB, Mongoose v8
- **Schema Validation**: Zod v3
- **Configuration**: Dotenv + Zod environment validation at startup
- **Security & Utilities**: Helmet, CORS, Morgan (dev logger)
- **Development Tooling**: tsx, ts-node-dev, ESLint, Prettier

---

## Folder Structure

```
booking-assignment/
├── scripts/
│   └── seed.ts                  # Seeds 2-3 initial teachers into MongoDB
├── src/
│   ├── config/
│   │   ├── db.ts                # Mongoose connection & disconnection lifecycle
│   │   └── env.ts               # Startup environment variable validation with Zod
│   ├── constants/
│   │   └── sessionStatus.ts     # SessionStatus enum (AVAILABLE, BOOKED, COMPLETED)
│   ├── controllers/
│   │   ├── session.controller.ts# Thin controller for session routes
│   │   ├── teacher.controller.ts# Thin controller for teacher routes
│   │   └── user.controller.ts   # Thin controller for user routes
│   ├── middlewares/
│   │   ├── errorHandler.ts      # Centralized error handler (ApiError, Zod, Mongoose, Mongo 11000)
│   │   ├── notFound.ts          # 404 handler for unknown routes
│   │   ├── validate.ts          # Generic Zod validation middleware for body/query/params
│   │   └── validateObjectId.ts  # Middleware validating 24-character hexadecimal MongoDB ObjectIds
│   ├── models/
│   │   ├── session.model.ts     # Mongoose schema & compound indexes for Session
│   │   ├── teacher.model.ts     # Mongoose schema for Teacher
│   │   └── user.model.ts        # Mongoose schema for User
│   ├── routes/
│   │   ├── index.ts             # Aggregate router mounting all resource sub-routes
│   │   ├── session.routes.ts    # Session endpoints
│   │   ├── teacher.routes.ts    # Teacher endpoints
│   │   └── user.routes.ts       # User endpoints
│   ├── services/
│   │   ├── session.service.ts   # Business logic, atomic updates, and aggregation queries
│   │   ├── teacher.service.ts   # Teacher service logic
│   │   └── user.service.ts      # User creation & session history facet aggregation
│   ├── utils/
│   │   ├── ApiError.ts          # Operational error class with statusCode & error details
│   │   ├── ApiResponse.ts       # Consistent response envelope { success, message, data }
│   │   └── asyncHandler.ts      # Async wrapper eliminating try/catch in controllers
│   ├── app.ts                   # Express app configuration & middleware pipeline
│   └── server.ts                # Bootstrap: connects DB, starts listener, handles graceful shutdown
├── .env.example
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── package.json
├── postman_collection.json      # Postman v2.1 collection with tests and auto-saving variables
├── README.md
└── tsconfig.json
```

---

## Prerequisites
- **Node.js**: `v18.0.0` or higher (LTS recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: A running MongoDB instance locally (`mongodb://127.0.0.1:27017`) or a remote MongoDB Atlas connection URI

---

## Setup & Running Locally

### 1. Clone the repository
```bash
git clone <repository_url>
cd booking-assignment
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `MONGODB_URI` points to your running MongoDB instance:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/booking_platform
NODE_ENV=development
```

### 4. Seed sample teachers
Populate the database with sample teachers:
```bash
npm run seed
```

### 5. Start the development server
```bash
npm run dev
```
The server will boot on `http://localhost:5000`.

To build and run in production mode:
```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Number | `5000` | Port on which the Express server listens (1-65535) |
| `MONGODB_URI` | String | *Required* | MongoDB connection URI string |
| `NODE_ENV` | String | `development` | Environment mode (`development`, `production`, `test`) |

If any required environment variable is missing or invalid, Zod rejects it immediately at startup and exits with code 1.

---

## Architecture & Design Decisions

### Prevention of Double Booking & Race Conditions
Double booking is prevented at the database layer using **atomic updates** without relying on error-prone "check-then-save" patterns:
```typescript
const updatedSession = await Session.findOneAndUpdate(
  {
    _id: sessionId,
    status: SessionStatus.AVAILABLE, // Atomically guards against race conditions
  },
  {
    $set: {
      status: SessionStatus.BOOKED,
      userId: new mongoose.Types.ObjectId(userId),
    },
  },
  {
    new: true,
    runValidators: true,
  },
);
```
- Because MongoDB applies document-level write locks on `findOneAndUpdate`, even if dozens of concurrent requests attempt to book the exact same session simultaneously, only the first transaction will match `{ status: 'AVAILABLE' }`.
- Any subsequent or simultaneous request finds 0 matching documents and returns `null`.
- The service inspects the document: if the session exists but status is no longer `AVAILABLE`, a `409 Conflict` error is returned ("Session is already booked or completed"). If the session ID does not exist, a `404 Not Found` is returned.

### MongoDB Aggregation Pipelines
As mandated, `find()` is avoided for complex reads in favor of optimized aggregation pipelines:
1. **`GET /sessions/available`**:
   - Matches documents where `status: 'AVAILABLE'` and `startTime` falls within the UTC day boundaries.
   - `$lookup` against `teachers` collection.
   - `$unwind` teacher details.
   - Clean projection shaping the response (`sessionId`, `startTime`, `endTime`, `status`, `teacher`).
   - Sorted chronologically by `startTime: 1`.
2. **`GET /users/:id/sessions`**:
   - Single pipeline with `$facet` to partition upcoming (`status: 'BOOKED'`) and completed (`status: 'COMPLETED'`) sessions in a single database roundtrip.
   - Upcoming sessions are sorted by `startTime: 1`.
   - Completed sessions are sorted by `completedAt: -1`.

### Compound Indexes
The `Session` schema includes the following compound indexes:
```typescript
SessionSchema.index({ status: 1, startTime: 1 });
SessionSchema.index({ userId: 1, status: 1 });
```
- `{ status: 1, startTime: 1 }` directly optimizes `GET /sessions/available`.
- `{ userId: 1, status: 1 }` directly optimizes `GET /users/:id/sessions`.

### Centralized Error Handling
All errors flow through `src/middlewares/errorHandler.ts`:
- **ApiError**: Custom operational errors return their specific `statusCode` and message.
- **ZodError**: Returns `400 Bad Request` with structured field-level error messages `{ field, message }`.
- **Mongoose CastError / ValidationError**: Returns `400 Bad Request`.
- **MongoDB Error 11000**: Returns `409 Conflict` for unique constraint violations (e.g. duplicate email).
- **Unhandled 500**: Stack traces are hidden when `NODE_ENV=production`.

### Consistent Response Format
Every response strictly follows the standard response shape:
- **Success (`2xx`)**:
  ```json
  {
    "success": true,
    "message": "Operation description",
    "data": { ... }
  }
  ```
- **Error (`4xx` / `5xx`)**:
  ```json
  {
    "success": false,
    "message": "Error description",
    "errors": [ ... ]
  }
  ```

### Assumptions
1. **Teacher Creation API (`POST /teachers`)**: The core prompt does not include an endpoint for creating teachers, but sessions require an existing `teacherId`. In addition to the `scripts/seed.ts` script, a `POST /teachers` and `GET /teachers` endpoint was implemented to support full programmatic testing and CRUD workflows.
2. **Day Boundaries for Available Sessions**: The `dateTimestamp` query parameter in `GET /sessions/available?dateTimestamp={timestamp}` is interpreted in **UTC** from `00:00:00.000` to `23:59:59.999`.
3. **User Upcoming Sessions**: In `GET /users/:id/sessions`, sessions with status `BOOKED` are categorized as upcoming sessions, while sessions with status `COMPLETED` are categorized as completed sessions.

---

## API Documentation

### 1. Extra: Create Teacher
- **Method**: `POST`
- **Path**: `/teachers`
- **Body**:
  ```json
  {
    "fullName": "Prof. Marie Curie",
    "email": "marie.curie@example.com",
    "specialization": "Radiochemistry & Physics",
    "experience": 10
  }
  ```
- **Responses**:
  - `201 Created`: Teacher created successfully.
  - `400 Bad Request`: Validation failure.
  - `409 Conflict`: Teacher with email already exists.

---

### 2. API 1: Create User
- **Method**: `POST`
- **Path**: `/users`
- **Body**:
  ```json
  {
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-0199"
  }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "User created successfully",
      "data": {
        "_id": "673f88f1e63a13d721111111",
        "fullName": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1-555-0199",
        "createdAt": "2026-11-20T12:00:00.000Z",
        "updatedAt": "2026-11-20T12:00:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Validation error (e.g. invalid email format or empty fields).
  - `409 Conflict`: User with email already exists.

---

### 3. API 2: Create Session
- **Method**: `POST`
- **Path**: `/sessions`
- **Body**: Accepts ISO 8601 strings or epoch timestamps in ms.
  ```json
  {
    "teacherId": "673f88f1e63a13d722222222",
    "startTime": "2026-11-20T14:00:00.000Z",
    "endTime": "2026-11-20T15:00:00.000Z"
  }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Session created successfully",
      "data": {
        "_id": "673f88f1e63a13d733333333",
        "teacherId": "673f88f1e63a13d722222222",
        "userId": null,
        "startTime": "2026-11-20T14:00:00.000Z",
        "endTime": "2026-11-20T15:00:00.000Z",
        "status": "AVAILABLE",
        "completedAt": null,
        "createdAt": "2026-11-20T12:00:00.000Z",
        "updatedAt": "2026-11-20T12:00:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Invalid ObjectId, invalid date, or `endTime <= startTime`.
  - `404 Not Found`: Teacher not found.

---

### 4. API 3: Get Available Sessions
- **Method**: `GET`
- **Path**: `/sessions/available?dateTimestamp=1732060800000`
- **Query Parameters**:
  - `dateTimestamp`: Epoch timestamp in milliseconds (e.g. `1732060800000`).
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Available sessions retrieved successfully",
      "data": {
        "date": "2026-11-20",
        "count": 1,
        "sessions": [
          {
            "sessionId": "673f88f1e63a13d733333333",
            "startTime": "2026-11-20T14:00:00.000Z",
            "endTime": "2026-11-20T15:00:00.000Z",
            "status": "AVAILABLE",
            "teacher": {
              "_id": "673f88f1e63a13d722222222",
              "fullName": "Prof. Alan Turing",
              "specialization": "Computer Science & Cryptography",
              "experience": 12
            }
          }
        ]
      }
    }
    ```
  - `400 Bad Request`: Missing or non-numeric `dateTimestamp`.

---

### 5. API 4: Book Session
- **Method**: `POST`
- **Path**: `/sessions/:id/book`
- **Body**:
  ```json
  {
    "userId": "673f88f1e63a13d721111111"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Session booked successfully",
      "data": {
        "_id": "673f88f1e63a13d733333333",
        "teacherId": "673f88f1e63a13d722222222",
        "userId": "673f88f1e63a13d721111111",
        "startTime": "2026-11-20T14:00:00.000Z",
        "endTime": "2026-11-20T15:00:00.000Z",
        "status": "BOOKED",
        "completedAt": null,
        "createdAt": "2026-11-20T12:00:00.000Z",
        "updatedAt": "2026-11-20T12:05:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Invalid ObjectId for session or user.
  - `404 Not Found`: Session or User not found.
  - `409 Conflict`: Session is already booked or completed.

---

### 6. API 5: Complete Session
- **Method**: `PATCH`
- **Path**: `/sessions/:id/complete`
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Session marked as completed successfully",
      "data": {
        "_id": "673f88f1e63a13d733333333",
        "teacherId": "673f88f1e63a13d722222222",
        "userId": "673f88f1e63a13d721111111",
        "startTime": "2026-11-20T14:00:00.000Z",
        "endTime": "2026-11-20T15:00:00.000Z",
        "status": "COMPLETED",
        "completedAt": "2026-11-20T15:01:00.000Z",
        "createdAt": "2026-11-20T12:00:00.000Z",
        "updatedAt": "2026-11-20T15:01:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Invalid ObjectId.
  - `404 Not Found`: Session not found.
  - `409 Conflict`: Session is not in `BOOKED` status (e.g. `AVAILABLE` or already `COMPLETED`).

---

### 7. API 6: Get User Sessions History
- **Method**: `GET`
- **Path**: `/users/:id/sessions`
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "User sessions retrieved successfully",
      "data": {
        "userId": "673f88f1e63a13d721111111",
        "upcomingSessions": [
          {
            "sessionId": "673f88f1e63a13d744444444",
            "startTime": "2026-11-21T10:00:00.000Z",
            "endTime": "2026-11-21T11:00:00.000Z",
            "status": "BOOKED",
            "teacher": {
              "_id": "673f88f1e63a13d722222222",
              "fullName": "Elena Rostova",
              "specialization": "Machine Learning & Neural Networks",
              "experience": 6
            }
          }
        ],
        "completedSessions": [
          {
            "sessionId": "673f88f1e63a13d733333333",
            "startTime": "2026-11-20T14:00:00.000Z",
            "endTime": "2026-11-20T15:00:00.000Z",
            "status": "COMPLETED",
            "completedAt": "2026-11-20T15:01:00.000Z",
            "teacher": {
              "_id": "673f88f1e63a13d722222222",
              "fullName": "Prof. Alan Turing",
              "specialization": "Computer Science & Cryptography",
              "experience": 12
            }
          }
        ],
        "counts": {
          "upcoming": 1,
          "completed": 1
        }
      }
    }
    ```
  - `400 Bad Request`: Invalid user ObjectId.
  - `404 Not Found`: User not found.

---

## Postman Collection
Import `postman_collection.json` into Postman.
- **Collection Variables**:
  - `baseUrl`: `http://localhost:5000`
  - `teacherId`, `userId`, `sessionId`: Automatically populated by test scripts upon executing creation requests.
- **Test Automation**:
  - Requests include automated test assertions verifying status codes, response headers, and data payloads.
  - Negative test folders cover all error cases: duplicate emails, malformed ObjectIds, invalid date intervals, race condition/double-booking protection, and unauthorized status transitions.

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts server in watch mode using `tsx` |
| `npm run build` | Compiles TypeScript files to `./dist` using `tsc` |
| `npm start` | Runs compiled production server from `./dist/server.js` |
| `npm run seed` | Seeds initial teachers into MongoDB |
| `npm run lint` | Runs ESLint type and style checks |
| `npm run lint:fix` | Runs ESLint and auto-fixes issues |
| `npm run format` | Formats all code with Prettier |
