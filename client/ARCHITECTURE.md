# Frontend architecture

Parley uses standalone Angular components and signals. The root application is a
screen composition shell, not the owner of chat or authentication behavior.

```text
src/
  app/
    app.ts / app.html / app.css       Application shell and session restoration
    core/
      models/                        Account and authentication contracts
      services/                      Credentialed HTTP, session lifecycle, theme
    pages/
      auth/                          Sign-in/signup form and layout
      phone-setup/                   Required primary-phone setup
      chat/                          Workspace composition and local UI state
    features/chat/
      models/                        Rooms, memberships, messages, commands
      services/                      Typed chat API endpoint adapter
      state/                         ChatStore: rooms, messages, sockets, reads
      utils/                         Message reconciliation/grouping, room titles
      components/
        navigation/                  Navigation rail and account action
        sidebar/                     Search, room list, previews, unread badges
        conversation-header/         Active room title and actions
        conversation-details/        Membership and account details
        conversation-dialog/         Create/manage form and focus management
        message-list/                Grouped transcript and scroll behavior
        message-composer/            Draft field, keyboard events, send action
        welcome/                     Empty workspace state
    shared/
      components/                    Icon, theme switch, phone field, avatar/name
      styles/controls.css            Small shared interface primitives
      utils/                         Identity/color helpers and phone-number rules
  testing/fixtures.ts                Test-only accounts, rooms and deferred requests
```

## Dependency direction

- `core` has no dependency on pages or chat UI.
- `shared` components may use core contracts/theme services, but never chat state
  or pages. Pure utilities do not perform HTTP, manipulate DOM, or own sessions.
- The chat feature depends on core/shared, never on a page.
- Pages compose components and call services/stores. They do not call `fetch` or
  attach socket listeners.
- Avoid barrel exports and compatibility re-exports: import directly from the
  module that owns a type, utility, or component.

## State and lifetimes

The root explicitly starts session restoration. The singleton session service
owns account identity, the authentication phase, auth errors, and sign-out.
The existing single-URL screen flow is intentionally preserved; there is no
unused router configuration or duplicate route/auth state.

The chat page provides its own `ChatStore` and explicitly initializes it.
The store owns endpoint operations, Socket.IO listeners, histories, persisted
read acknowledgements, unread summaries, and typing timers. Leaving chat
destroys the store, disconnects its socket, and removes listeners/timers.
Session revision checks and request generations reject stale responses.
Read-only state signals prevent view components from mutating domain state.

UI-only state stays with its owner: auth form fields on the auth page, the phone
field on phone setup, search in the sidebar, draft/details/dialog visibility on
the chat page, and dialog form fields/focus management in the dialog component.
Presentational chat components communicate through typed inputs and outputs.

## Data flow

1. A component emits a user action.
2. The chat page invokes the store, or an auth page invokes the session service.
3. The feature API adapter uses the core credentialed HTTP client.
4. Responses/socket events update store signals.
5. Components render read-only inputs.

Sending uses REST only; the socket broadcast and history are merged by message ID.
Draft clearing belongs to the chat page and happens only after a successful send
to the same conversation. The composer stays read-only, not disabled, while
sending, so Enter does not lose focus.

## Styling

`src/styles.css` owns theme tokens, base element rules, and shared-control styles.
Each page/component owns its layout, responsive rules, and appearance details.
No page imports another page's stylesheet. Shared avatars and usernames centralize
permanent identity colors and accessible theme-specific ink.
Country metadata stays behind the deferred phone-input component.

## Tests

Tests live beside the module they verify. Core-service tests cover session and
theme lifecycles; chat-store tests cover state, transport and stale requests;
component tests cover keyboard/focus, grouping and validation; utility tests cover
pure transforms. Root integration tests verify screen transitions and the full
composer-to-store path.

```sh
npm test -- --watch=false
npm run build
```
