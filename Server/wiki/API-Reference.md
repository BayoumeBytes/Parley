# API Reference

The API base URL is:

```text
http://localhost:3000/api
```

Requests with JSON bodies should send:

```http
Content-Type: application/json
```

Private endpoints require the session cookie returned by login.

## Common authentication responses

An absent, invalid, or expired session returns:

```http
401 Unauthorized
```

The server also clears the invalid session cookie.

## Authentication

### Register

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

| Status | Meaning | Response |
| --- | --- | --- |
| `201` | User created | `{"message":"registered"}` |
| `400` | Missing field | `{"message":"fields are required"}` |
| `409` | Username or email exists | `{"message":"user already exists"}` |
| `500` | Unexpected error | `{"message":"internal server error"}` |

### Login

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

Success:

```json
{
  "message": "logged in"
}
```

The response sets a session cookie. Statuses are `400` for missing fields,
`404` when the user is not found, `401` for an invalid password, and `500` for
an unexpected error.

### Logout

```http
POST /auth/logout
```

Private. Clears the session cookie and returns:

```json
{
  "message": "logged out"
}
```

## Conversations

### Create a direct room

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

Exactly two user IDs are required. The endpoint name is shared with group
creation for historical reasons.

### Create a group room

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

Group rooms require a non-empty `name`. The authenticated creator is assigned
the `owner` role if their ID is in `members`.

### Add members

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

Success:

```json
{
  "success": true,
  "added": ["USER_ID_4", "USER_ID_5"]
}
```

The room must exist and be a group. Existing memberships are not added again.

### Remove members

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

Success:

```json
{
  "success": true,
  "removed": ["USER_ID_5"]
}
```

### List rooms

```http
POST /conv/getuserrooms
```

Private. No request body is required. The authenticated user is taken from the
session:

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

## Messages

### Send a message

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

Success:

```json
{
  "result": "success"
}
```

The current implementation accepts `sender` from the body. Clients should use
the authenticated user's ID, but the server should derive this value from
`req.user` before production use.

### Get room history

```http
GET /msg/getroomhistory
```

The current implementation reads `room` from the JSON request body:

```json
{
  "room": "ROOM_ID"
}
```

Success:

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

Messages are sorted newest first.

