# Architecture

## Source layout

```text
src/
├── server.js                    # Process entrypoint and startup
├── app.js                       # Express app and middleware
├── config/config.js             # Port and MongoDB connection
├── routes/routes.js             # Route mounting
├── middleware/requireAuth.js    # Session-cookie authentication
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
└── utils/password.util.js        # Password hashing and verification
```

## Request flow

```text
HTTP request
  → Express middleware
  → requireAuth for private routes
  → controller
  → service
  → Mongoose model
  → MongoDB
```

Controllers translate HTTP requests into service calls and choose response
status codes. Services contain database operations and conversation rules.
Models define MongoDB schemas and indexes.

## Application startup

`src/server.js`:

1. Imports the Express application.
2. Imports the runtime configuration and database connector.
3. Connects to MongoDB.
4. Starts listening on `PORT`, or `3000` by default.

`src/app.js`:

1. Loads environment variables.
2. Enables CORS.
3. Enables JSON request parsing.
4. Enables cookie parsing.
5. Enables `errorhandler` in development.
6. Mounts the API router at `/api`.

## Route groups

| Prefix | Authentication | Responsibility |
| --- | --- | --- |
| `/api/auth` | Register and login are public; logout is private | User authentication and sessions |
| `/api/conv` | Private | Room creation, membership, and room listing |
| `/api/msg` | Private | Message creation and room history |

## Authentication boundary

`requireAuth` reads the configured session cookie, looks up the session in
MongoDB, and rejects missing or expired sessions with `401 Unauthorized`.
Valid requests receive:

```js
req.user = { id: "..." };
req.sessionId = "...";
```

Private route handlers use `req.user.id` for the authenticated user. The
current message creation controller still accepts `sender` from the request
body; see [Operations and Security](Operations-and-Security).

## Conversation rules

- Direct rooms require exactly two users.
- Direct rooms use a sorted pair of user IDs as a unique `directKey`.
- Group rooms require a non-empty name.
- Group membership is unique per room/user pair.
- A group creator is marked `owner` when their ID is included in the initial
  member list.
- Membership operations reject non-group rooms.

## Real-time status

The current source tree contains no WebSocket, Socket.IO, or server-sent event
implementation. `POST /api/msg/sendmsg` writes a message to MongoDB, and
`GET /api/msg/getroomhistory` reads persisted messages. A future real-time
implementation should define connection authentication, room subscription,
message fan-out, reconnect behavior, and delivery/error semantics.

