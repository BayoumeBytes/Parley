# Operations and Security

## Test suite

Run from `Server/`:

```bash
pnpm test
```

The command sets `NODE_ENV=test` and uses a 10-second timeout. Jest currently
contains service tests for message creation and room-history retrieval.

Run ESLint:

```bash
pnpm exec eslint src test
```

## Production checklist

1. Provision MongoDB and verify network access from the server.
2. Set `NODE_ENV=production` and a production `PORT`.
3. Configure a production session cookie name.
4. Serve the API over HTTPS because the cookie is marked `secure`.
5. Restrict CORS to the frontend's exact origin.
6. Store environment values and database credentials in the deployment
   platform's secret manager.
7. Run `pnpm test` in CI.
8. Configure process supervision, logs, restarts, and MongoDB backups.

The repository's GitLab CI configuration includes SAST and secret-detection
templates. It does not currently define a deployment job.

## Security behavior

- Session cookies are HTTP-only and secure.
- Sessions expire after 24 hours.
- Invalid sessions receive `401 Unauthorized`.
- Username and email fields have unique database indexes.
- Passwords are not stored in plaintext.

## Security work still required

### Replace SHA-256 password hashing

`src/utils/password.util.js` currently uses unsalted SHA-256. Production
password storage should use a slow, salted password KDF such as Argon2,
scrypt, or bcrypt. Existing users will need a migration strategy.

### Add authorization checks

Authentication verifies that a user has a valid session, but the current
conversation and message services do not consistently verify that the user is
a member of the target room or has the required role. Add authorization checks
for:

- Reading room history
- Sending messages
- Adding members
- Removing members
- Creating rooms on behalf of the authenticated user

### Derive the message sender

`POST /msg/sendmsg` currently accepts `sender` from the request body. The
server should use `req.user.id` instead, preventing a client from submitting
messages as another user.

### Restrict CORS

`app.js` currently calls `cors()` without an explicit origin policy. Configure
the allowed frontend origin(s) before production deployment.

## Known limitations

- No WebSocket, Socket.IO, or server-sent event transport exists yet.
- MongoDB host, port, and database name are hard-coded in
  `src/config/config.js`.
- There is no health, readiness, or metrics endpoint.
- Room history has no pagination limit and returns the full history.
- Expired session documents are not periodically removed.
- Response formats and status codes are not fully standardized.

## Logging and failure behavior

Database and service errors are logged or returned through the controller
error response. In development, Express `errorhandler` is enabled. Production
deployments should add structured logging, request correlation IDs, and a
centralized error-monitoring strategy.

## Contributing

1. Create a focused branch.
2. Keep changes within the appropriate controller/service/model boundary.
3. Add or update tests for behavior changes.
4. Run `pnpm test` and lint changed files.
5. Update the relevant Wiki page when routes, configuration, or data contracts
   change.

