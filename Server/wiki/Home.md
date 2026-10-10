# Parley Server Wiki

The **Parley Server** is the backend for the Parley chat application. It is an
ES module Node.js service built with Express and Mongoose. It provides user
registration and login, cookie-based sessions, conversation management, and
message persistence through MongoDB.

> **Current implementation:** the server exposes an HTTP/JSON REST API. There
> is currently no WebSocket or Socket.IO implementation in `src/`. The
> message API persists chat messages, but REST requests do not provide
> real-time fan-out by themselves.

## Wiki pages

- [Getting Started](Getting-Started) — prerequisites, installation,
  configuration, and local development
- [Architecture](Architecture) — source layout, startup flow, and request
  lifecycle
- [API Reference](API-Reference) — authentication, conversation, and message
  endpoints
- [Data Model](Data-Model) — MongoDB collections, fields, indexes, and
  relationships
- [Operations and Security](Operations-and-Security) — testing, deployment,
  security notes, and known limitations

## Quick facts

| Area | Technology |
| --- | --- |
| Runtime | Node.js with ECMAScript modules |
| HTTP | Express 5 |
| Database | MongoDB through Mongoose |
| Authentication | MongoDB-backed sessions and HTTP-only cookies |
| Testing | Jest |
| Package manager | pnpm 12.8.1 |

## Repository location

The backend source is located in:

```text
Server/
```

The server process starts at `Server/src/server.js`.

