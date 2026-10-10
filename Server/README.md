# Parley Server

The **Parley Server** is the backend for the Parley chat application. It is an
ES module Node.js service built with Express and Mongoose. The server provides
user registration and login, cookie-based sessions, conversation/room
management, and message persistence through MongoDB.

> **Current transport:** the checked-in server exposes an HTTP/JSON REST API.
> There is currently no WebSocket or Socket.IO server in `src/`, so clients
> should use the message endpoints for persistence. Real-time delivery will
> require an additional event transport or a separate real-time service.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the server](#running-the-server)
- [Architecture](#architecture)
- [Authentication and sessions](#authentication-and-sessions)
- [HTTP API](#http-api)
- [Data model](#data-model)
- [Testing](#testing)
- [Deployment and operations](#deployment-and-operations)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)

## Features

- Register users with a unique username and email address.
- Authenticate users with a signed-in session stored in MongoDB.
- Protect private endpoints with an HTTP-only session cookie.
- Create direct conversations between exactly two users.
- Create named group conversations.
- Add and remove members from group conversations.
- List a user's room memberships.
- Send messages and retrieve room history.
- Validate core service behavior with Jest unit tests.

## Technology

| Area | Technology |
| --- | --- |
| Runtime | Node.js with ECMAScript modules |
| HTTP | Express 5 |
| Database | MongoDB through Mongoose |
| Authentication | MongoDB-backed sessions and cookies |
| Password hashing | Node.js `crypto` SHA-256 utility |
| Testing | Jest, Babel Jest, and Supertest dependencies |
| Package manager | pnpm 12.8.1 |
| Development server | Nodemon |
| CI/security | GitLab CI templates for SAST and secret detection |

## Requirements

- Node.js compatible with the installed dependencies.
- pnpm 12.8.1 or a compatible pnpm release.
- A running MongoDB instance.

The default database connection is:

```text
mongodb://localhost:27017/Parley
```

## Installation

From the repository root:

```bash
cd Server
pnpm install
```

Create a local `.env` file. The server currently expects the session cookie
name from the `session` variable:

```dotenv
NODE_ENV=development
PORT=3000
session=__Host-session
```

`PORT` is optional and defaults to `3000`. The MongoDB host, port, and database
name are currently defined in `src/config/config.js` rather than environment
variables:

```js
host: "localhost",
port: 27017,
name: "Parley",
```

Do not commit credentials or production secrets to `.env`. Add a production
environment file through the deployment platform's secret/configuration
mechanism instead.

## Running the server

Start the development server with automatic restart:

```bash
pnpm dev
```

The startup sequence is:

1. Load environment variables with `dotenv`.
2. Connect to MongoDB.
3. Mount the Express application.
4. Listen on `PORT` or port `3000`.

The API base URL is:

```text
http://localhost:3000/api
```

The application enables JSON request parsing, cookies, and CORS. In
development, Express's `errorhandler` middleware is enabled.

## Architecture

```text
src/
├── server.js                    # Process entrypoint and startup sequence
├── app.js                       # Express app and middleware registration
├── config/
│   └── config.js                # Port and MongoDB connection
├── routes/
│   └── routes.js                # /auth, /conv, and /msg route mounting
├── middleware/
│   └── requireAuth.js           # Session-cookie authentication
├── controllers/
│   ├── AuthController.js
│   ├── ConversationController.js
│   └── MessagesController.js
├── services/
│   ├── AuthService.js
│   ├── ConversationService.js
│   ├── MessagesService.js
│   └── SessionService.js
├── models/
│   ├── Users.js
│   ├── Session.js
│   ├── Room.js
│   ├── MemberShip.js
│   └── Messages.js
└── utils/
    └── password.util.js         # Password hashing and verification
```

Requests flow through the application as:

```text
HTTP request
  → Express middleware
  → requireAuth (private routes)
  → controller
  → service
  → Mongoose model
  → MongoDB
```

The controllers handle HTTP status codes and request/response shapes. Services
contain database operations and conversation rules. Models define the MongoDB
schemas and indexes.

## Authentication and sessions

### Public endpoints

`POST /api/auth/register` and `POST /api/auth/login` are public. All other
routes are mounted after `requireAuth`, including logout.

### Login flow

1. The server looks up the user by `username`.
2. The supplied password is hashed and compared with the stored hash.
3. A 32-byte random session identifier plus a timestamp is generated.
4. A session document is stored with a 24-hour expiration time.
5. The identifier is sent in the configured cookie name.

The cookie is configured as HTTP-only, secure, `SameSite=Lax`, and scoped to
`/`. Because it is secure, local HTTP clients may need HTTPS or a test-specific
cookie configuration.

### Authenticated request

Send the cookie returned by login with subsequent requests:

```bash
curl -b cookies.txt http://localhost:3000/api/conv/getuserrooms
```

An absent, invalid, or expired session returns `401 Unauthorized` and clears
the cookie.

## HTTP API

All examples assume:

```text
http://localhost:3000/api
```

Private endpoints require the session cookie. JSON request bodies should use
`Content-Type: application/json`.

### Authentication

#### Register

```http
POST /auth/register
```

Request:

```json
{
  "username": "alice",
  "password": "correct horse battery staple",
  "email": "alice@example.com"
}
```

Responses:

| Status | Meaning | Body |
| --- | --- | --- |
| `201` | User created | `{"message":"registered"}` |
| `400` | A required field is missing | `{"message":"fields are required"}` |
| `409` | Username or email already exists | `{"message":"user already exists"}` |
| `500` | Unexpected server/database error | `{"message":"internal server error"}` |

#### Login

```http
POST /auth/login
```

Request:

```json
{
  "username": "alice",
  "password": "correct horse battery staple"
}
```

On success, the response sets the session cookie:

```json
{
  "message": "logged in"
}
```

Responses include `400` for missing fields, `404` when the user is not found,
`401` for an invalid password, and `500` for an unexpected error.

#### Logout

```http
POST /auth/logout
```

Requires authentication and clears the session cookie:

```json
{
  "message": "logged out"
}
```

### Conversations

#### Create a direct conversation

```http
POST /conv/creategroup
```

Request:

```json
{
  "type": "direct",
  "members": ["USER_ID_1", "USER_ID_2"]
}
```

A direct conversation requires exactly two user IDs. The server creates a
stable sorted `directKey`, so the same pair resolves to the same room.

#### Create a group conversation

```http
POST /conv/creategroup
```

Request:

```json
{
  "type": "group",
  "name": "Project team",
  "members": ["USER_ID_1", "USER_ID_2", "USER_ID_3"]
}
```

Group rooms require a non-empty `name`. The authenticated user is marked as
the `owner` when their ID is included in `members`; all other initial members
are marked as `member`.

Successful creation returns the created room (or a `{ "room": ... }` result
for group creation). Invalid input returns `400`; service failures return
`500`.

#### Add members

```http
POST /conv/addmembers
```

Request:

```json
{
  "roomId": "ROOM_ID",
  "newmembers": ["USER_ID_4", "USER_ID_5"]
}
```

Only group rooms accept new members. Existing memberships are ignored and
successful additions return:

```json
{
  "success": true,
  "added": ["USER_ID_4", "USER_ID_5"]
}
```

#### Remove members

```http
POST /conv/removemembers
```

Request:

```json
{
  "roomId": "ROOM_ID",
  "members": ["USER_ID_5"]
}
```

Successful removal returns:

```json
{
  "success": true,
  "removed": ["USER_ID_5"]
}
```

#### List a user's rooms

```http
POST /conv/getuserrooms
```

No request body is required. The authenticated user's ID is taken from the
validated session. Successful responses have the shape:

```json
{
  "result": [
    {
      "room": "ROOM_ID",
      "user": {
        "_id": "USER_ID",
        "username": "alice"
      }
    }
  ]
}
```

### Messages

#### Send a message

```http
POST /msg/sendmsg
```

Request:

```json
{
  "message": "Hello from Parley",
  "room": "ROOM_ID",
  "sender": "USER_ID"
}
```

Successful persistence returns:

```json
{
  "result": "success"
}
```

The current controller accepts `sender` from the request body. Clients should
use the authenticated user's ID; a future hardening change should derive this
value from `req.user` instead.

#### Get room history

```http
GET /msg/getroomhistory
```

The current implementation reads `room` from the JSON request body:

```json
{
  "room": "ROOM_ID"
}
```

Successful responses return messages newest first:

```json
{
  "History": [
    {
      "_id": "MESSAGE_ID",
      "message": "Hello from Parley",
      "room": "ROOM_ID",
      "sender": "USER_ID",
      "createdAt": "2026-01-01T12:00:00.000Z"
    }
  ]
}
```

## Data model

| Collection/model | Important fields and rules |
| --- | --- |
| `User` | `username`, `email`, `password`, `Avatar`, `createdAt`, `updatedAt`; username and email are unique |
| `Session` | `sessionId`, `userId`, `expiresAt`; used by authentication middleware |
| `Room` | `name`, `type` (`group` or `direct`), optional unique `directKey` |
| `MemberShip` | `room`, `user`, `role` (`owner`, `admin`, or `member`), `joinedAt`, `lastReadAt`; room/user pair is unique |
| `Message` | `message`, `room`, `sender`, `createdAt`; indexed by room and sender |

Rooms and users are related through `MemberShip`; messages reference both a
room and a sender. MongoDB references are stored as ObjectIds.

## Testing

Run the configured Jest suite from `Server/`:

```bash
pnpm test
```

The test command sets `NODE_ENV=test` and uses a 10-second test timeout.
Jest is configured to discover tests under `test/`; the current suite includes
service tests for message creation and room-history retrieval.

TypeScript is configured for JavaScript checking support, but the project does
not currently expose a `typecheck` script. Linting can be run with the local
ESLint binary if needed:

```bash
pnpm exec eslint src test
```

## Deployment and operations

Before deployment:

1. Provision MongoDB and confirm the server can reach it.
2. Set `NODE_ENV=production`, `PORT`, and a production session cookie name.
3. Serve the API over HTTPS because the session cookie is marked `secure`.
4. Configure CORS for the frontend's exact origin rather than leaving it open.
5. Keep `.env` and database credentials outside version control.
6. Run `pnpm test` in CI before starting the service.

The repository's GitLab CI configuration includes SAST and secret detection
templates. It does not currently define a deployment job or a health-check
endpoint. Process supervision, logging, restarts, and database backups should
be provided by the deployment platform.

## Security notes

- Session cookies are HTTP-only and secure.
- Session records expire after 24 hours and are checked on every private request.
- Usernames and emails have unique MongoDB indexes.
- Passwords are not stored in plaintext.
- The current password utility uses unsalted SHA-256. Production deployments
  should replace it with a slow, salted password KDF such as Argon2, scrypt,
  or bcrypt.
- CORS is currently enabled with the default `cors()` configuration. Restrict
  allowed origins before production use.
- Authorization is not yet enforced per room operation. Authentication proves
  that a session exists, but controllers should additionally verify that the
  current user belongs to a room and has permission to add/remove members or
  send/read messages.
- The API currently trusts the `sender` field in `POST /msg/sendmsg`; derive
  it from the authenticated session before treating the endpoint as
  production-ready.

## Known limitations

- No WebSocket/Socket.IO implementation is present; REST calls do not by
  themselves provide real-time fan-out.
- MongoDB host, port, and database name are hard-coded in
  `src/config/config.js`.
- There is no health, readiness, or metrics endpoint.
- Message history has no pagination limit and returns the entire room history.
- Session cleanup for expired documents is not scheduled.
- Controllers use several legacy response/status shapes, so clients should
  follow the endpoint-specific contract above.

## Contributing

1. Create a focused branch.
2. Make changes within the appropriate controller/service/model boundary.
3. Add or update Jest tests for behavior changes.
4. Run `pnpm test` and lint the changed files.
5. Update this README when routes, configuration, or data contracts change.

Keep authentication, authorization, and persistence changes explicit in code
review. Avoid committing `.env` files, generated graph output, or database
artifacts.
