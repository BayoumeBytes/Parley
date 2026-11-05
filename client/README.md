# Parley client

Angular 22 frontend for the Express/MongoDB server in `../Server`. The interface
uses a warm neutral palette, a conversation sidebar, a message workspace, and
an account/conversation details panel. The mobile layout switches between the
conversation list and the active chat.

## Run locally

Use a Node version supported by Angular 22 (the project was validated with
Node 26). Start MongoDB and the backend first; see `../Server/README.md`.

```sh
cd Server
pnpm install
pnpm dev
```

In a second terminal:

```sh
cd client
npm ci --include=dev
npm start
```

Open **http://localhost:4200**. Keep the backend's `CLIENT_URL` set to
`http://localhost:4200` (its default). Use matching hostnames: opening the client
on `127.0.0.1` while the backend allows `localhost` prevents socket handshakes.
`proxy.conf.json` forwards `/api` and `/socket.io` (including WebSocket upgrades)
to `http://localhost:3000`, keeping browser requests same-origin.

## Features

- Registration with a required, unique primary phone number and automatic sign-in;
  login, logout, and cookie-session restoration.
- Create direct conversations and named group conversations.
- Filter conversations by their displayed name.
- Chronological message history with date separators and automatic scrolling.
- Persisted text messages, multiline input, and the server's 10,000-character limit.
- Socket.IO live updates, typing indicators with idle expiry, and in-session
  unread counts for inactive rooms.
- Reconnect refreshes the selected conversation's history. Messages from history,
  REST responses, and socket broadcasts are reconciled by persisted `_id`.
- Owners/admins can add and remove group members. Membership notifications refresh
  the room list and remove inaccessible conversations across connected tabs.
- Start chats and manage members using exact usernames, emails, or primary phone numbers.
- Direct chats display the other participant's username; groups display their required name.
- Conversation details list members by username, without exposing their contact information.
- Loading/error/empty states, keyboard-accessible dialogs with focus management,
  responsive layouts, and reduced-motion support.

### Try a conversation

1. Create two accounts in separate browser profiles (or use a private window).
2. Supply a different primary phone number for each account, including its country
   code (for example, `+201012345678`). Spaces, parentheses, dots, and hyphens are normalized.
3. Choose **Start a conversation** and enter the other person's username, email,
   or primary phone number. Identifiers are exact matches, not partial searches.
4. For a group, enter a non-blank group name and separate people with commas or
   new lines. The creator is included automatically.
5. Exchange messages. Group owners/admins can add or remove members using the
   same identifiers.

## API boundaries

The backend supports authenticated exact user lookups, not a browsable user
directory or partial-name search. It does **not** have profile editing,
attachments, message edits/deletion, read receipts, presence, or paginated
history. The frontend does not fake these features. Message senders and direct
chat titles use participant usernames. Group names are taken from server metadata.
The account's username is available in room memberships; restored accounts
without any rooms display “You” until a membership or login supplies it.

The room-list endpoint adds `roomDetails: { _id, name, type }`, `role`, and
`participants: [{ _id, username }]`,
while preserving the original string `room` and populated `user` fields.
Deleted-room memberships are omitted.

New signups require `phoneNumber`. Existing accounts without a stored phone can
still sign in and be found by username/email, but cannot be found by phone until
their number is populated. There is no SMS verification or phone-editing flow.
See the backend README for the unique-index rollout notes.

Messages are sent **only through REST**, which already publishes `newMessage`.
There is no second socket send or automatic retry. A network failure may mean
the server saved the message but the response was lost; refresh history before
resending. Unread counts are transient browser state, not persistent read receipts.

## Checks

```sh
npm run build
npm test -- --watch=false
```

The frontend tests cover authentication restoration, room rendering, group
management permissions, session revocation, failed-send draft retention,
credentialed API requests, legacy API errors, and live/history deduplication.

## Production

`npm run build` writes static files to `dist/client/browser`. Serve these files
with an SPA fallback to `index.html`. The Angular development proxy is not part
of that build: configure your production reverse proxy to forward `/api` and
`/socket.io` to the backend, enabling WebSocket upgrades. Serve both over HTTPS,
set `NODE_ENV=production`, and set `CLIENT_URL` to the exact public frontend
origin. Authentication stays in HTTP-only cookies; no session token is stored
in local storage.

Google Fonts supplies DM Sans and Manrope; system sans-serif fonts are the
fallback when that service is unavailable.
