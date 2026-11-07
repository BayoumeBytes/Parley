# Parley server

The Node.js backend for Parley, combining an Express REST API, authenticated
Socket.IO connections, and MongoDB persistence. HTTP and socket sends share
message validation, room authorization, persistence, and event publishing.

[Project overview](../README.md) · [Angular client](../client/README.md)

## Contents

- [Capabilities](#capabilities)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Authentication and account setup](#authentication-and-account-setup)
- [HTTP API](#http-api)
- [Real-time API](#real-time-api)
- [Data model and indexes](#data-model-and-indexes)
- [Commands and testing](#commands-and-testing)
- [Deployment and operations](#deployment-and-operations)
- [Security and current limitations](#security-and-current-limitations)

## Capabilities

- Username/password authentication with MongoDB-backed sessions (24 hours by default).
- Unique usernames, emails, and normalized primary phone numbers.
- Required primary-phone setup for legacy accounts, enforced on chat APIs and
  socket handshakes.
- Exact account lookup by username, email, or primary phone.
- Permanent account-ID-derived colors with conditional legacy backfill.
- Reusable direct conversations and named group conversations.
- Owner/admin-only group membership changes and live subscription updates.
- Membership-protected message sending/history and persist-before-publish delivery.
- Latest-message summaries and durable per-user unread/read progress.
- Live messages, transient typing state, reconnect readiness, and session revocation.

## Requirements

- **Node.js 26 recommended** to align with the full repository's validation baseline.
- **pnpm 12.8.1**, as declared in [`package.json`](package.json).
- A running **MongoDB** server.
- The sibling [`shared/`](../shared/) directory; the server imports its color
  implementation directly.

This is an ES module JavaScript service, not a TypeScript compilation target.
There is no server build step or `start` script; its runtime entry point is
[`src/server.js`](src/server.js).

## Local development

From the repository root:

```sh
cd Server
pnpm install --frozen-lockfile
```

Copy the template in **this directory**, unless you already have a `.env`:

```sh
cp .env.example .env
```

Edit `MONGODB_URI` and the other settings described below for your environment.

Start MongoDB at `localhost:27017`, then run from `Server/`:

```sh
pnpm dev
```

The default database is **`Parley`**. Startup connects to MongoDB, creates the
HTTP server, attaches Socket.IO, and listens on `PORT`.

| Interface              | Default address                             |
| ---------------------- | ------------------------------------------- |
| REST API               | `http://localhost:3000/api`                 |
| Socket.IO              | `http://localhost:3000`, path `/socket.io/` |
| Allowed browser origin | `http://localhost:4200`                     |

The loader always reads `Server/.env`, even when running
`node Server/src/server.js` from the repository root.
Start the UI using the [client guide](../client/README.md#local-development).

## Configuration

All values come from process environment variables or `Server/.env`.
Process environment takes precedence, including in production. A missing `.env`
is allowed; malformed settings stop startup with an error naming the setting.
Restart the backend after editing it.

| Variable                              | Default                            | Purpose and validation                                                                                        |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                            | `development`                      | `development`, `test`, or `production`; production enables the Secure `__Host-session` cookie                 |
| `HOST`                                | `0.0.0.0`                          | Listening interface; use `127.0.0.1` to restrict local access                                                 |
| `PORT`                                | `3000`                             | HTTP and Socket.IO port, integer 1–65535                                                                      |
| `CLIENT_URL`                          | `http://localhost:4200`            | One exact HTTP(S) frontend origin, without credentials, path, query, or fragment                              |
| `MONGODB_URI`                         | `mongodb://localhost:27017/Parley` | Full `mongodb://` or `mongodb+srv://` connection URI, including database and optional credentials/TLS options |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `2000`                             | Positive integer timeout in milliseconds, maximum 2147483647                                                  |
| `SESSION_TTL_HOURS`                   | `24`                               | Integer 1–168; expiry for newly created sessions only                                                         |

Use [`.env.example`](.env.example) as the safe template. Store actual database
credentials only in the ignored `.env` or your deployment secret manager.
Percent-encode reserved characters in MongoDB usernames/passwords and quote
values containing `#` in `.env`. Database connection errors deliberately omit
driver details that could disclose credentials.

There is no JWT/signing secret: authentication uses random session IDs backed
by MongoDB. Do not invent a `JWT_SECRET` or put a database URI in client settings.
Cookie security follows `NODE_ENV`; use HTTPS in production rather than disabling
Secure cookies. Keep client `API_PROXY_TARGET` aligned with the backend address
and `CLIENT_URL` aligned with the browser's actual origin.

## Architecture

```text
src/
├── server.js                        HTTP server, database startup, Socket.IO
├── app.js                           Express middleware and /api mount
├── config/config.js                 Environment defaults and MongoDB connection
├── config/env.js                    Validated backend environment settings
├── config/load-env.cjs              Project-relative .env loading
├── routes/routes.js                 Authentication and chat route composition
├── middleware/
│   ├── requireAuth.js               Cookie-session validation
│   └── requirePhone.js              Required primary-phone guard
├── controllers/                     HTTP status codes and response envelopes
├── services/
│   ├── AuthService.js               Registration, password checks, session creation
│   ├── AccountService.js            Safe profiles, phone completion, color backfill
│   ├── SessionService.js            Session identifier generation
│   ├── UserService.js               Exact identifier resolution
│   ├── ConversationService.js       Rooms, memberships, summaries
│   ├── RoomAccessService.js         ObjectId and membership/role checks
│   ├── MessagesService.js           Shared message persistence and history
│   └── ReadStateService.js          Read cursors and unread/latest aggregates
├── models/                          User, Session, Room, MemberShip, Message
├── sockets/
│   ├── index.js                     Handshakes, event handlers, readiness
│   └── events.js                    Publishing and subscription/session updates
└── utils/                           Phone normalization and password utility

test/                                Jest suites and HTTP/socket transport helpers
../shared/account-color.mjs          Shared deterministic color function
```

Protected HTTP requests pass through session and phone guards before a
controller invokes a service. Services own conversation rules and database work;
models own schema/index definitions. Socket sends call the same message/access
services as REST sends.

## Authentication and account setup

### Sessions

Login accepts a **username**, not an email/phone login identifier. On success,
the server creates a session with the configured expiry (24 hours by default)
and sets an HTTP-only cookie.

| Environment      | Cookie           | Attributes                                     |
| ---------------- | ---------------- | ---------------------------------------------- |
| Development/test | `session`        | `HttpOnly`, `SameSite=Lax`, `Path=/`           |
| Production       | `__Host-session` | Above attributes plus `Secure`; requires HTTPS |

Private HTTP requests validate the session on each request. Socket handshakes
authenticate from the same cookie; handled events revalidate the session.
An expiry timer disconnects idle sockets. Logout deletes that session and
disconnects sockets sharing it, rather than revoking every separately created
session for the account.

Browser clients must include credentials. Sessions are not JWTs and should not
be copied into local storage.

### Phone setup and safe profiles

Registration requires an international `phoneNumber`. Normalization removes
spaces, parentheses, dots, and hyphens, then requires `+`, a nonzero initial digit,
and 8–15 digits. The database unique index enforces uniqueness.

Legacy accounts can authenticate without a valid number. Their own profile
returns `requiresPhone: true`; `/auth/me`, `/auth/phone`, and logout remain
available. Chat APIs return `403` with `code: "PHONE_REQUIRED"` until setup is
complete. Socket handshakes reject the account before room subscription.

Phone completion only fills a missing/invalid primary number. It cannot replace
an already valid primary number and uses a conditional update to prevent a stale
request overwriting another completion. **No SMS ownership verification is performed.**

The caller's own profile includes `_id`, `username`, `color`, `phoneNumber`, and
`requiresPhone`. Public lookup/participant profiles contain only `_id`, `username`,
and `color`.

### Permanent colors

[`../shared/account-color.mjs`](../shared/account-color.mjs) zero-extends a
MongoDB account ID to 128 bits and XOR-folds it like Java's `UUID.hashCode()`.
The lowest 24 bits become RGB, scaled so the highest channel is 230; zero RGB
uses `#e6e6e6`.

Registration saves the color. Login, profile restoration, and socket initialization
conditionally backfill missing colors without replacing existing ones. Username
changes do not affect the calculation. This is deterministic, not collision-free.

## HTTP API

All paths below are relative to **`/api`**. Send JSON with
`Content-Type: application/json`. Object IDs in examples are illustrative:
use actual IDs returned by login/profile and user resolution.

### Access and route summary

| Method | Path                  | Access              | Purpose                                      |
| ------ | --------------------- | ------------------- | -------------------------------------------- |
| POST   | `/auth/register`      | Public              | Create an account                            |
| POST   | `/auth/login`         | Public              | Authenticate and set the cookie              |
| GET    | `/auth/me`            | Session             | Restore the caller's profile                 |
| POST   | `/auth/phone`         | Session             | Complete required primary-phone setup        |
| POST   | `/auth/logout`        | Session             | Revoke the current session                   |
| POST   | `/users/resolve`      | Session + phone     | Resolve exact account identifiers            |
| POST   | `/conv/creategroup`   | Session + phone     | Create/reuse a direct chat or create a group |
| POST   | `/conv/getuserrooms`  | Session + phone     | Read memberships, previews, unread counts    |
| POST   | `/conv/addmembers`    | Group owner/admin   | Add group members                            |
| POST   | `/conv/removemembers` | Group owner/admin   | Remove group members                         |
| POST   | `/msg/sendmsg`        | Current room member | Persist and broadcast a message              |
| GET    | `/msg/getroomhistory` | Current room member | Read complete room history                   |
| POST   | `/msg/markread`       | Current room member | Advance private read progress                |

Membership endpoints also require a valid session and completed phone setup.

### Profile, phone completion, logout

- `GET /auth/me` returns `{"user": ...}` using the profile shape above.
- `POST /auth/phone` accepts `{"phoneNumber":"+12025550123"}` and returns the
  updated `{"user": ...}`. Format errors return `400`; duplicate, already-complete,
  or concurrent-update conflicts return `409`.
- `POST /auth/logout` requires no body, clears the cookie, and returns
  `{"message":"logged out"}`.

A missing/expired session returns `401`; the authentication middleware uses a
plain `Unauthorized` response rather than a JSON error envelope.

### Error envelopes

Most chat/account failures use `{"error":"..."}`; registration/login failures
use `{"message":"..."}`. Authentication middleware can return plain text.
Phone guards additionally return `code: "PHONE_REQUIRED"`. Some controllers retain
legacy status/response shapes, so integrations must follow endpoint-specific
contracts rather than assume one universal envelope.

## Real-time API

Connect using Socket.IO at `/socket.io/`, after authenticating and completing
phone setup:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  withCredentials: true,
  autoConnect: false,
});

socket.on("ready", ({ userId, user, rooms }) => {
  // Refresh room summaries and the selected history.
});
socket.on("newMessage", (message) => {
  // Merge by message._id, including the sending client's broadcast echo.
});
socket.on("roomRead", ({ room }) => {
  // Refresh the caller's private unread summaries.
});
socket.on("connect_error", (error) => {
  // error.data?.code === "PHONE_REQUIRED" requires account setup.
});
socket.connect();
```

Register listeners once, outside a `connect` callback. On every successful
connection/reconnect, the server joins the account/session channels, loads
memberships, joins conversation channels, and emits
`ready: { userId, user, rooms }`.

### Client events and acknowledgements

| Event         | Payload              | Success acknowledgement |
| ------------- | -------------------- | ----------------------- |
| `sendMessage` | `{ room, message }`  | `{ ok: true, message }` |
| `joinRoom`    | `{ room }`           | `{ ok: true, room }`    |
| `leaveRoom`   | `{ room }`           | `{ ok: true, room }`    |
| `typing`      | `{ room, isTyping }` | `{ ok: true, room }`    |

Failures acknowledge `{ ok: false, status, error }`. Without an acknowledgement
callback, failures are emitted as `chatError`. Handshake failures use
`connect_error`; missing phone setup includes
`data: { code: "PHONE_REQUIRED", user }`.

`leaveRoom` only unsubscribes that socket; it does not remove membership.
`joinRoom` checks membership before subscribing. `typing` requires a boolean
`isTyping` and current membership.

### Server events

| Event                             | Payload                      | Audience                                           |
| --------------------------------- | ---------------------------- | -------------------------------------------------- |
| `ready`                           | `{ userId, user, rooms }`    | Connecting socket after subscriptions              |
| `newMessage`                      | Persisted message document   | Subscribed room sockets, including the sender      |
| `typing`                          | `{ room, userId, isTyping }` | Other subscribed sockets in the room               |
| `roomAdded` / `roomRemoved`       | `{ room }`                   | Affected account's connected sockets               |
| `membersAdded` / `membersRemoved` | `{ room, members }`          | Remaining/subscribed room sockets                  |
| `roomRead`                        | `{ room }`                   | Reader's connected sockets, not other participants |

The bundled Angular client sends through REST and listens through Socket.IO.
External clients may instead use `sendMessage`, but must choose **one send
transport per action**. Acknowledgement timeouts do not prove a save failed;
automatic retries can duplicate messages without an idempotency design.

Typing state is transient. Emit `false` on blur/send and expire indicators on
the client. Membership changes use REST; the server updates subscriptions.
Recover missed events by refreshing summaries/history, not by assuming event replay.

## Data model and indexes

| Model        | Main fields                                                                    | Indexes/rules                                                 |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `User`       | Username, email, primary phone, color, password hash, avatar field, timestamps | Unique username/email; unique partial phone index             |
| `Session`    | Session ID, account reference, expiry                                          | Expiry checked by application logic; no TTL cleanup index     |
| `Room`       | Name, type, direct key                                                         | Unique partial string `directKey`                             |
| `MemberShip` | Room/account references, role, join time, read timestamp/message ID            | Unique room/account pair; account lookup index                |
| `Message`    | Room/sender references, text, creation time                                    | Room and sender indexes; compound room/creation-time/ID index |

References use MongoDB ObjectIds. Unread counts are derived from messages and
membership cursors, not maintained as a separate counter. Summary queries batch
latest-message and unread aggregation across the caller's rooms.

## Commands and testing

Run from `Server/`:

| Command                 | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `pnpm dev`              | Nodemon development server                          |
| `node src/server.js`    | Run the service directly                            |
| `pnpm test`             | Jest suites, setting `NODE_ENV=test`                |
| `pnpm test:integration` | Real HTTP/Engine.IO polling transport tests         |
| `pnpm lint`             | ESLint over source, tests, and ESLint configuration |

The default suites use mocked database operations and an in-memory HTTP/socket
transport. They cover session/phone guards, color assignment, exact lookup,
message authorization/persistence, failed saves, membership subscriptions,
typing, read cursors, unread summaries, and logout.

Integration mode needs permission to bind localhost ports. Its MongoDB operations
are still mocked: it is not a live-database or deployment test. Run a real MongoDB
smoke test separately before release.

There are no server `build`, `start`, or `typecheck` scripts. The GitLab pipeline
currently includes SAST/secret-detection templates, not these application test jobs.

## Deployment and operations

1. Address the security limitations below before exposing a public deployment.
2. Preserve the sibling `shared/` module in the deployed source layout.
3. Configure a protected MongoDB connection using `MONGODB_URI`.
4. Set `NODE_ENV=production`, `PORT`, and the exact public `CLIENT_URL`.
5. Run `node src/server.js` from `Server/` under a process supervisor.
6. Serve HTTPS and reverse-proxy `/api` and `/socket.io`, including WebSocket upgrades.
7. Verify schema indexes, sessions, cross-tab logout, membership eviction, and
   unread restoration against the deployed database.
8. Provide backups, logging, monitoring, restarts, and expiry-record cleanup.

### Primary-phone index rollout

The unique phone index uses:

```json
{
  "unique": true,
  "partialFilterExpression": {
    "phoneNumber": { "$type": "string" }
  }
}
```

This allows multiple legacy accounts without a phone while enforcing uniqueness
for stored numbers. Normalize existing phone data and resolve duplicates before
creating the index. Verify `phoneNumber_1` exists if automatic index creation is
disabled. A plain unique index over missing values is not a substitute.

There is no automatic phone-number backfill. Legacy users complete setup on login;
missing colors are assigned lazily. Deployment of the code does not itself supply
valid numbers or create a migration history.

### Scaling

Socket channels/subscriptions and session disconnects currently use the default
in-memory adapter. Multiple server instances require a shared adapter and
coordinated revocation/membership behavior. Do not assume load-balancing alone
preserves the single-process guarantees.

## Security and current limitations

- **Password storage needs hardening:** the current utility is unsalted SHA-256,
  not a production password KDF. Replace it with Argon2, scrypt, or bcrypt and
  plan migration of existing hashes.
- Primary-phone uniqueness/format is not ownership verification. No SMS,
  password-reset, or email-verification workflow is implemented.
- There is no application rate limiter or dedicated CSRF-token mechanism;
  review request validation, error disclosure, origin policy, and abuse protection.
- Messages are not end-to-end encrypted.
- CORS is configured for one exact origin; WebSocket handshakes additionally
  check the origin. Credentialed cookies on unrelated sites require a different
  deployment/cookie design.
- Message history is unpaginated and accessible in full to current members.
- Offline events are not queued, and message sends have no idempotency key.
- Group roles exist, but promotion/demotion endpoints do not.
- There is no health/readiness/metrics endpoint or scheduled expired-session cleanup.
- Attachments, edits/deletion, presence, public read receipts, and partial user
  search are outside the current API.

Keep authentication/authorization changes explicit in review, add regression tests
for changed contracts, and update the API sections alongside route changes.
