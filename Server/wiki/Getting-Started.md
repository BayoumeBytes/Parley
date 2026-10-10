# Getting Started

## Requirements

- Node.js compatible with the installed dependencies
- pnpm 12.8.1 or a compatible pnpm release
- A running MongoDB instance

The default MongoDB connection is:

```text
mongodb://localhost:27017/Parley
```

## Install dependencies

From the repository root:

```bash
cd Server
pnpm install
```

## Configure the environment

Create `Server/.env`:

```dotenv
NODE_ENV=development
PORT=3000
session=__Host-session
```

`PORT` is optional and defaults to `3000`. The `session` variable controls the
name used for the authentication cookie.

The MongoDB host, port, and database name are currently defined in
`src/config/config.js`:

```js
host: "localhost",
port: 27017,
name: "Parley",
```

Do not commit `.env` files or production credentials.

## Start the development server

```bash
pnpm dev
```

The server starts at:

```text
http://localhost:3000
```

The API base path is:

```text
http://localhost:3000/api
```

Startup connects to MongoDB before Express begins listening. If the database
connection fails, the process logs the failure and exits.

## Verify authentication

Register a user:

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"change-me","email":"alice@example.com"}'
```

Log in and save the cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"change-me"}'
```

Use the cookie on private routes:

```bash
curl -i -b cookies.txt \
  -X POST http://localhost:3000/api/conv/getuserrooms
```

The session cookie is configured as HTTP-only, secure, `SameSite=Lax`, and
scoped to `/`. Because it is marked secure, local clients may need HTTPS or a
development-specific cookie configuration.

## Useful commands

Run tests:

```bash
pnpm test
```

Run ESLint:

```bash
pnpm exec eslint src test
```

