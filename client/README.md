# Parley client

The Angular frontend for Parley. It provides account onboarding, direct and group
chat, persisted unread state, and a responsive light/dark interface backed by
the Express and Socket.IO server in [`../Server`](../Server/README.md).

[Project overview](../README.md) · [Architecture guide](ARCHITECTURE.md) ·
[Interface design rules](UI_DESIGN.md) · [Backend API](../Server/README.md#http-api)

## Contents

- [Capabilities](#capabilities)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [State and data flow](#state-and-data-flow)
- [Phone input and identity](#phone-input-and-identity)
- [Themes and accessibility](#themes-and-accessibility)
- [Commands and tests](#commands-and-tests)
- [Production deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Capabilities

- Registration, username/password login, logout, and cookie-session restoration.
- A required phone-setup screen for legacy accounts, enforced by the backend too.
- Country selection with flags/dialing codes and local-number input.
- Direct chats named after the other participant and groups with required names.
- Conversation creation/member management by exact username, email, or phone lookup.
- Server-restored latest-message previews and unread badges, including offline arrivals.
- Chronological, unboxed messages grouped by consecutive sender and local date.
- An icon-only send control, multiline input, and Enter-to-send without focus loss.
- Live messages, typing state, membership notifications, and reconnect recovery.
- Account-ID-derived identity colors, with contrast-adjusted username text.
- Light/dark switching, keyboard-accessible dialogs, and mobile workspace layouts.

## Requirements

| Tool/service | Requirement                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Node.js      | Angular CLI supports `^22.22.3`, `^24.15.0`, or `>=26.0.0`; Node 26 is the recommended workspace baseline |
| npm          | The manifest declares `npm@11.20.0`                                                                       |
| Backend      | Parley API/Socket.IO server, normally `http://localhost:3000`                                             |
| Database     | MongoDB is required by the backend, not accessed directly by the client                                   |

Install development dependencies for builds and tests. The source checkout must
also contain the sibling [`shared/`](../shared/) directory, which supplies the
account-color implementation and its TypeScript declaration.

## Local development

Start MongoDB and the backend using the [server setup instructions](../Server/README.md#local-development).

In a separate terminal, from the repository root:

```sh
cd client
npm ci --include=dev
cp .env.example .env
npm start
```

Open **http://localhost:4200**. Run the remaining frontend commands from `client/`.

### API and socket proxy

[`proxy.conf.cjs`](proxy.conf.cjs) forwards using `API_PROXY_TARGET`:

| Browser path | Development target                                 |
| ------------ | -------------------------------------------------- |
| `/api`       | `http://localhost:3000`                            |
| `/socket.io` | `http://localhost:3000`, with WebSocket forwarding |

The HTTP client uses relative `/api/...` URLs with `credentials: "include"`.
Socket.IO connects to the same browser origin with `withCredentials: true`.
Requests appearing under port `4200` in DevTools are therefore expected; the
development server forwards them to port `3000`.

Keep the backend's `CLIENT_URL` equal to `http://localhost:4200`. If the frontend
origin or backend port changes, update the allowed origin and proxy accordingly.
Do not mix `localhost` and `127.0.0.1`.

## Configuration

Copy [`.env.example`](.env.example) to `client/.env` if it does not already
exist. `npm start` loads it from the client directory, independently of the
current working directory. Process environment variables override file values.
Restart the development server after changes.

| Variable               | Default                 | Purpose                                                                                       |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `DEV_HOST`             | `localhost`             | Angular listening interface; `0.0.0.0` exposes the dev server to the network                  |
| `DEV_PORT`             | `4200`                  | Angular port, integer 1–65535                                                                 |
| `API_PROXY_TARGET`     | `http://localhost:3000` | HTTP(S) backend origin; no credentials, path, query, or fragment                              |
| `API_PROXY_VERIFY_TLS` | `true`                  | Backend TLS certificate verification; `false` only for trusted local self-signed certificates |

Example for custom ports:

```dotenv
DEV_HOST=localhost
DEV_PORT=4300
API_PROXY_TARGET=http://localhost:3100
API_PROXY_VERIFY_TLS=true
```

Pair that with `PORT=3100` and `CLIENT_URL=http://localhost:4300` in
`Server/.env`. Explicit Angular CLI flags override host/port defaults:
`npm start -- --port 4400` (also update server `CLIENT_URL`).
Direct `ng serve` uses the environment-aware proxy, but host/port defaults from
`.env` are applied by the `npm start` wrapper, not by Angular itself.

**Never put secrets in frontend configuration.** These settings are used by
Node development tooling only and are not compiled into the browser bundle.
There are no client API keys or database credentials to configure. Production
builds keep same-origin `/api` and `/socket.io`; set production listening ports,
TLS, and backend routing on your static host/reverse proxy. Angular build
options remain in [`angular.json`](angular.json).

Run `npm run test:config` to validate the development-tooling configuration
tests alongside the Angular tests.

## Project structure

```text
src/
├── app/
│   ├── app.ts / app.html / app.css   Screen composition and startup
│   ├── core/
│   │   ├── models/                  Account and authentication contracts
│   │   └── services/                HTTP, session lifecycle, theme preference
│   ├── pages/
│   │   ├── auth/                    Sign-in/signup form and layout
│   │   ├── phone-setup/             Required primary-phone setup
│   │   └── chat/                    Workspace and local UI coordination
│   ├── features/chat/
│   │   ├── components/              Navigation, sidebar, header, details,
│   │   │                            dialogs, message list, composer, welcome
│   │   ├── models/                  Rooms, messages, memberships, commands
│   │   ├── services/                Typed backend endpoint adapter
│   │   ├── state/                   Page-scoped ChatStore
│   │   └── utils/                   Message reconciliation/grouping and titles
│   └── shared/
│       ├── components/              Icons, phone input, theme toggle, identity
│       ├── styles/                  Shared control primitives
│       └── utils/                   Colors, initials, phone-number rules
├── testing/                         Test fixtures and deferred-request helpers
├── styles.css                       Theme tokens and global element rules
└── index.html                       Metadata and before-paint theme initialization

public/                              Static icons, favicon, theme bootstrap
scripts/                             Node-only environment loader, dev launcher, tests
proxy.conf.cjs                       Environment-aware API and Socket.IO proxy
.env.example                         Safe local-development configuration template
```

Tests live beside the service, component, or utility they verify. For dependency
rules and extension guidance, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## State and data flow

### Application screens

The root starts session restoration and renders one of four states:

```text
Loading → Authentication
        → Required phone setup
        → Chat workspace
```

These are session-driven pages, not separate router URLs. Session identity and
phone requirements come from `GET /api/auth/me`; room memberships are not used
as a substitute for the account profile.

### Ownership

| Layer                     | Responsibility                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Core session service      | Account, session phase, authentication operations, session errors                          |
| Chat store                | Rooms, histories, unread summaries, socket listeners, typing timers, read acknowledgements |
| Chat page                 | Draft, details/dialog visibility, composition of chat components                           |
| Presentational components | Typed inputs/outputs, rendering, keyboard and focus behavior                               |
| Shared controls/utilities | Reusable identity display, phone input, icons, pure formatting                             |

The chat store is provided by the chat page. Leaving chat disconnects its socket,
removes event listeners, and clears timers. Request generations/session revisions
reject stale responses so an old request cannot repopulate a new session.
Views consume read-only domain state rather than writing room/message data.

### Sending and receiving messages

1. The composer emits a send action.
2. The chat page asks the store to persist the draft through REST.
3. The backend saves it and broadcasts `newMessage`.
4. History, the REST response, and live events are reconciled by `_id`.
5. The draft clears only after success in the same conversation.

The client does not send the same action over both transports, and it does not
automatically retry sends. A lost response can leave delivery uncertain; refresh
history before resending. While sending, the textarea is read-only rather than
disabled to preserve focus.

### Unread progress and reconnects

Room summaries provide `lastMessage` and `unreadCount` without loading every
history. A conversation is marked read through its latest displayed message
only after history loads and the tab is visible. Own messages do not increase
the count. Failed history/read updates do not silently clear badges.

Read progress persists on the server and is synchronized through private
`roomRead` events. Reconnects refresh summaries and the selected history.
Legacy browser-only read status cannot be reconstructed; opening an older
conversation establishes its saved message cursor.

## Phone input and identity

### Primary phone numbers

Signup and required-phone setup use one Angular form control with a native
country selector, flag, dialing code, and local-number field.

- Country metadata/parsing comes from `libphonenumber-js/min`.
- No country is inferred from the browser locale.
- National prefixes follow country rules: an Egyptian/UK trunk zero is removed,
  while Italy's significant zero is retained.
- Pasting a complete international number selects its country without duplicating
  the prefix.
- The backend still receives one international `phoneNumber` string.
- Country metadata is deferred until a phone form is displayed.

For example, selecting United States (`+1`) and entering `2025550123` produces
`+12025550123`. Backend normalization and the unique database index remain
authoritative. Phone setup does **not** verify ownership through SMS.

### Account colors

[`shared/account-color.mjs`](../shared/account-color.mjs) is shared with the
backend. It zero-extends the immutable MongoDB account ID to 128 bits, folds it
like Java's UUID hash, uses the lowest 24 bits as RGB, and scales the highest
channel to 230. Zero RGB falls back to visible gray.

Avatars use the assigned color. Username ink is darkened or lightened for readable
contrast against the active theme; the stored color does not change. Hash
collisions are possible, and usernames are never inputs to the calculation.

## Themes and accessibility

The sun/moon switch is available in the navigation rail, on authentication
screens, and during phone setup.

The theme service follows the system until an explicit choice is made. It saves
that choice under `localStorage["parley-theme"]` and synchronizes it between tabs.
This preference is local to the browser, not synchronized through the account.
When storage is blocked, switching still works for the current page.

[`public/theme-init.js`](public/theme-init.js) applies the theme in the document
head before Angular/styles load, preventing a light flash on dark-mode reloads.
Native controls use the matching `color-scheme`.

Shared semantic color tokens live in [`src/styles.css`](src/styles.css).
Component/page styles own layout and responsive behavior. The interface includes
visible keyboard focus, named icon controls, focus-managed dialogs, and
reduced-motion support. Country names supplement flags in the native select.

DM Sans and Manrope are loaded through Google Fonts, with sans-serif fallbacks.
Design and icon attribution is recorded in [`UI_DESIGN.md`](UI_DESIGN.md) and
[`public/icons.svg`](public/icons.svg).

## Commands and tests

Run from `client/`:

| Command                                                                   | Purpose                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `npm start`                                                               | Development server with proxy and live reload  |
| `npm run build`                                                           | Optimized production build                     |
| `npm run watch`                                                           | Rebuild the development bundle on file changes |
| `npm test`                                                                | Angular/Vitest test runner                     |
| `npm test -- --watch=false`                                               | One-shot test run                              |
| `npm exec -- prettier --check src ARCHITECTURE.md README.md UI_DESIGN.md` | Source/document formatting check               |

Tests cover core session/theme lifecycles, endpoint contracts, chat state and
transport behavior, unread reconciliation, phone conversion, identity contrast,
message grouping, dialog validation/focus, and the integrated composer path.
The unit/integration suites mock network operations; real-backend/browser smoke
tests are a separate check.

## Production deployment

From `client/`:

```sh
npm ci --include=dev
npm run build
```

Deploy **`dist/client/browser/`**, not the source directory. The shared source
module is bundled at build time; it is not a separate runtime asset requirement
for the static deployment.

| Public path                           | Hosting behavior                                                |
| ------------------------------------- | --------------------------------------------------------------- |
| `/` and application document requests | Serve built assets, with an `index.html` fallback               |
| `/api/...`                            | Reverse-proxy to the backend without removing the `/api` prefix |
| `/socket.io/...`                      | Forward Socket.IO HTTP traffic and WebSocket upgrades           |

Use HTTPS and set the backend's `NODE_ENV=production` and `CLIENT_URL` to the
exact public origin. The development proxy is not part of the static build.
Keep the backend and frontend contracts at matching revisions.

The build enforces configured bundle/style budgets in [`angular.json`](angular.json).
There is no frontend lint script or standalone deployment job in this project.

## Troubleshooting

| Symptom                                         | Check                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Requests show port `4200`                       | Expected with the development proxy; inspect the response, not just the browser URL           |
| `/api/users/resolve` returns `404`              | Run the backend from the same checkout/revision; confirm the new routes are loaded            |
| Login works but sockets fail                    | Match `CLIENT_URL` to the browser origin; do not mix hostnames; forward `/socket.io` upgrades |
| Cannot reach Parley                             | Start MongoDB/backend, verify port `3000`, and check the proxy target                         |
| A moved/new stylesheet or module cannot resolve | Restart `npm start`; if it persists, run `npm exec -- ng cache clean` and restart             |
| Old tab icon or assets remain visible           | Refresh or reopen the tab; check static-asset caching                                         |
| Phone setup remains open                        | Choose a country, enter a possible national number, and resolve duplicate-number errors       |
