# Parley Server

The **Parley Server** is the backend for the Parley chat application. It is an
ES module Node.js service built with Express and Mongoose. The server provides
user registration and login, cookie-based sessions, conversation/room
management, and message persistence through MongoDB.

Messages can be sent through REST or authenticated Socket.IO connections on the
same server. Both paths persist first, then publish the complete message to its
room. This repository contains the backend; frontend integration is shown below.

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
- [Realtime API](#realtime-api)
- [Data model](#data-model)
- [Testing](#testing)
- [Deployment and operations](#deployment-and-operations)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)

## Features

- Register users with a unique username, email address, and required primary phone number.
- Resolve exact usernames, emails, or primary phone numbers into chat participants.
- Authenticate users with a signed-in session stored in MongoDB.
- Protect private endpoints with an HTTP-only session cookie.
- Create direct conversations between exactly two users.
- Create named group conversations.
- Add and remove members from group conversations.
- List a user's room memberships.
- Send messages and retrieve room history with room membership checks.
- Receive room-scoped messages, typing indicators, and membership notifications.
- Automatically subscribe connected tabs and devices to their conversations.
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

Create a local `.env` file:

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:4200
```

`PORT` defaults to `3000`; `CLIENT_URL` defaults to `http://localhost:4200`
and controls the credentialed HTTP and Socket.IO origins. Cookie names are
`session` in development/test and `__Host-session` in production. The legacy
`session` environment variable is no longer used. The MongoDB host, port, and database
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
4. Attach Socket.IO to the same HTTP server and listen on `PORT` or port `3000`.

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

src/sockets/                    # Authentication, events, and room subscriptions
src/services/RoomAccessService.js # Shared room authorization
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

The cookie is HTTP-only, `SameSite=Lax`, and scoped to `/`. Production uses
a secure `__Host-session` cookie over HTTPS. Development uses `session` over
HTTP so the same login works for REST and Socket.IO on localhost.

### Authenticated request

Send the cookie returned by login with subsequent requests:

```bash
curl -X POST -b cookies.txt http://localhost:3000/api/conv/getuserrooms
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
  "email": "alice@example.com",
  "phoneNumber": "+201012345678"
}
```

Responses:

| Status | Meaning | Body |
| --- | --- | --- |
| `201` | User created | `{"message":"registered"}` |
| `400` | A required field is missing or invalid | `{"message":"Username, email, password and primary phone number are required"}` or a phone-format error |
| `409` | Username, email, or primary phone already exists | `{"message":"Username, email or primary phone number is already in use"}` |
| `500` | Unexpected server/database error | `{"message":"internal server error"}` |

`phoneNumber` is required at signup in international `+<country code><number>`
format, with 8–15 digits total and a nonzero first digit. Spaces, parentheses,
dots, and hyphens are removed before lookup/storage, so `+1 (202) 555-0123` and
`+12025550123` are the same unique number. Missing/invalid numbers return `400`.
The number is not SMS-verified.

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

Responses include `400` for missing fields, `401` when the user is not found,
`401` for an invalid password, and `500` for an unexpected error.

#### Logout

```http
POST /auth/logout
```

Requires authentication, deletes the session, disconnects all sockets using that
session, and clears the cookie:

```json
{
  "message": "logged out"
}
```

### Conversations

#### Resolve people before creating or updating a conversation

```http
POST /users/resolve
```

This authenticated endpoint accepts exact usernames, emails, or international
primary phone numbers:

```json
{ "identifiers": ["alice", "bob@example.com", "+1 (202) 555-0123"] }
```

It returns `{ "users": [{ "_id": "USER_ID", "username": "alice" }] }`.
It never returns email addresses, phone numbers, or passwords. There must be
1–50 identifiers, each at most 254 characters. Username and email matching use
their exact stored spelling; phone matching normalizes formatting. Multiple
identifiers resolving to the same account are deduplicated. Missing users
return `404`; an identifier that matches different accounts across fields
returns `409` instead of choosing someone arbitrarily. Use the returned IDs in
the conversation endpoints below; the frontend handles that conversion.

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

Group rooms require a non-empty `name`. The authenticated creator is always
included and is marked as `owner`; other initial members are marked as `member`.
For direct chats, supply the other user alone or both users. Exactly two distinct
users, including the creator, are required. Connected members receive `roomAdded`.

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

Only group owners and admins may add or remove members. Only group rooms
accept membership changes. Added users subscribe immediately; removed users
are evicted across their connected tabs and devices. Existing memberships are ignored and
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
      "roomDetails": {
        "_id": "ROOM_ID",
        "name": "Project team",
        "type": "group"
      },
      "role": "owner",
      "participants": [
        { "_id": "USER_ID", "username": "alice" },
        { "_id": "OTHER_USER_ID", "username": "bob" }
      ],
      "user": {
        "_id": "USER_ID",
        "username": "alice"
      }
    }
  ]
}
```

`room` remains the original ID. `roomDetails` and `role` let clients display
room names/types and membership controls without changing that field.
`participants` lists only IDs/usernames for current members of the caller's
rooms. Direct chats display the other member's username; groups display their
required `roomDetails.name`.
Memberships referencing deleted rooms are omitted.

### Messages

#### Send a message

```http
POST /msg/sendmsg
```

Request:

```json
{
  "message": "Hello from Parley",
  "room": "ROOM_ID"
}
```

Successful persistence returns HTTP `201` with `{ "result": "success", "message":
{ "_id": "MESSAGE_ID", "message": "Hello from Parley", "room": "ROOM_ID",
"sender": "USER_ID", "createdAt": "..." } }` and publishes the same message
as `newMessage` to room subscribers. `sender` comes from the session; any body
`sender` is ignored. Messages must be strings with non-whitespace content and
at most 10,000 characters. Invalid input returns `400`, non-members return
`403`, and persistence failures return `500` without broadcasting.

#### Get room history

```http
GET /msg/getroomhistory?room=ROOM_ID
```

Use the `room` query parameter. A legacy JSON body is also accepted.
Only current room members can retrieve history.

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

## Realtime API

Socket.IO is served on the API server's default `/socket.io/` path. Log in first
using `credentials: "include"`, then connect with `withCredentials: true`.
The browser sends the HTTP-only cookie automatically; no client-supplied user ID
or session token is required. Use matching hostnames (for example, `localhost`
for both frontend and backend). The cookie uses `SameSite=Lax`; deployments on
unrelated sites need a separate cookie/CORS configuration.

Every connection, including reconnects, loads current memberships and emits
`ready: { userId, rooms: [roomId] }` after subscribing. Wait for `ready` to refresh
history. Register listeners once, outside `connect`, so reconnects do not duplicate
them. Reconcile live messages and history by `_id`.

| Client event | Payload | Success acknowledgement |
| --- | --- | --- |
| `sendMessage` | `{ room, message }` | `{ ok: true, message: savedMessage }` |
| `joinRoom` | `{ room }` | `{ ok: true, room }` |
| `leaveRoom` | `{ room }` | `{ ok: true, room }` |
| `typing` | `{ room, isTyping: boolean }` | `{ ok: true, room }` |

Errors acknowledge `{ ok: false, status, error }`. Without an acknowledgement
callback, errors arrive as `chatError`. Handshake failures arrive as
`connect_error`. `leaveRoom` only unsubscribes that socket; it does not delete
membership. `joinRoom` subscribes again after checking membership.

| Server event | Payload and audience |
| --- | --- |
| `newMessage` | Full persisted `{ _id, room, sender, message, createdAt }`, including the sending socket if subscribed |
| `typing` | `{ room, userId, isTyping }` to other sockets subscribed to the room |
| `roomAdded` / `roomRemoved` | `{ room }` to every connected socket of the affected user |
| `membersAdded` / `membersRemoved` | `{ room, members: [userId] }` to remaining room subscribers |

Membership changes use the REST conversation endpoints. The server updates
subscriptions automatically. On `roomAdded`, refresh the room list; on
`roomRemoved`, remove that room from the UI. Typing is transient: emit `false`
on blur/send and clear indicators after a short client-side timeout.

Frontend example (install `socket.io-client` in the frontend project):

```js
import { io } from "socket.io-client";

const api = "http://localhost:3000";
await fetch(`${api}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});

const socket = io(api, { withCredentials: true, autoConnect: false });
socket.on("newMessage", (message) => upsertMessageById(message));
socket.on("ready", async ({ rooms }) => {
  for (const room of rooms) {
    const response = await fetch(
      `${api}/api/msg/getroomhistory?room=${encodeURIComponent(room)}`,
      { credentials: "include" },
    );
    const { History } = await response.json();
    History.forEach(upsertMessageById);
  }
});
socket.on("connect_error", (error) => console.error(error.message));
socket.on("chatError", (error) => console.error(error));
socket.connect();

function send(room, message) {
  socket.timeout(5000).emit("sendMessage", { room, message }, (timeout, result) => {
    if (timeout) return console.error("Delivery status unknown; refresh history");
    if (!result.ok) return console.error(result.error);
    upsertMessageById(result.message);
  });
}

// REST sends are also broadcast, so existing REST clients can listen to newMessage.
// await fetch(`${api}/api/msg/sendmsg`, { method: "POST", credentials: "include",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ room, message: "Hello" }) });
```

`username`, `password`, and `upsertMessageById` above belong to the frontend.
Socket.IO middleware and room behavior follow the official
[middleware](https://socket.io/docs/v4/middlewares/) and
[rooms](https://socket.io/docs/v4/rooms/) APIs.

## Data model

| Collection/model | Important fields and rules |
| --- | --- |
| `User` | `username`, `email`, `phoneNumber`, `password`, `Avatar`, `createdAt`, `updatedAt`; username, email and primary phone are unique |
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

The test command sets `NODE_ENV=test`.
The suite exercises Express routes and real Socket.IO packet parsing, middleware,
rooms, and handlers through an in-memory transport with mocked database operations.
It checks authentication, isolated delivery, sender identity, validation, failed
saves, membership changes, typing, history, and logout. It does not require MongoDB
or a listening port. To run the same cases over real HTTP/Engine.IO polling:

```bash
pnpm test:integration
```

The integration mode needs permission to bind a localhost port. MongoDB operations
remain mocked in both modes; a live database smoke test is still useful before deployment.

TypeScript is configured for JavaScript checking support, but the project does
not currently expose a `typecheck` script. Linting can be run with the local
ESLint binary if needed:

```bash
pnpm lint
```

## Deployment and operations

### Primary phone number rollout

New registrations require `phoneNumber`; old documents without it remain
readable and can still log in or be resolved by username/email. The phone index
is unique with a partial filter `{ phoneNumber: { $type: "string" } }`, so
multiple legacy accounts without a phone do not block index creation.
There is no automatic phone backfill or SMS verification.

Before deploying to a database that already has phone data, normalize those
numbers and resolve duplicates before creating the index. Confirm that the
unique `phoneNumber_1` index exists (provision it explicitly if automatic index
creation is disabled). Do not use a plain unique index over missing values.
No existing database has been migrated by this change.

Before deployment:

1. Provision MongoDB and confirm the server can reach it.
2. Set `NODE_ENV=production`, `PORT`, and `CLIENT_URL` to the frontend origin.
3. Serve the API over HTTPS because the session cookie is marked `secure`.
4. Configure CORS for the frontend's exact origin rather than leaving it open.
5. Keep `.env` and database credentials outside version control.
6. Run `pnpm test` in CI before starting the service.

The repository's GitLab CI configuration includes SAST and secret detection
templates. It does not currently define a deployment job or a health-check
endpoint. Process supervision, logging, restarts, and database backups should
be provided by the deployment platform.

## Security notes

- Session cookies are HTTP-only and secure in production.
- Session records expire after 24 hours and are checked on every private request.
- Usernames, emails, and normalized primary phone numbers have unique MongoDB indexes.
- Passwords are not stored in plaintext.
- The current password utility uses unsalted SHA-256. Production deployments
  should replace it with a slow, salted password KDF such as Argon2, scrypt,
  or bcrypt.
- HTTP and Socket.IO share an exact allowed frontend origin and credentials.
- Socket handshakes validate the session cookie; each handled event revalidates
  it. Expiration disconnects idle sockets, and logout revokes the session.
- Message sends, history reads, room joins, and typing require room membership.
- Only room owners and admins can add or remove group members.
- Sender identity is always derived from the authenticated session.

## Known limitations

- Realtime room management currently assumes one server process and the default
  in-memory adapter. Multiple instances need a shared Socket.IO adapter and
  coordinated session revocation.
- Offline events are not queued. Reload history after reconnecting and deduplicate
  messages by `_id`. Sending through both REST and sockets creates two messages;
  choose one send transport per action. Automatic retries need an idempotency
  design before they can guarantee one persisted message.
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
