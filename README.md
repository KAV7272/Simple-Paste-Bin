# Paste Application

Minimal pastebin-style app with syntax highlighting (Prism.js) and configurable expirations (10 minutes, 1 hour, 24 hours, 7 days, never). No auth required—paste, save, and share a link.

## Running locally

```bash
npm install
npm start
# open http://localhost:3000
```

## Docker

```bash
docker build -t paste-app .
docker run -p 3000:3000 paste-app
# open http://localhost:3000
```

## API

- `POST /api/pastes` with JSON `{ content, expiresIn, language }` where `expiresIn` is `10m | 1h | 24h | 7d | never` and `language` is a Prism language id (e.g. `javascript`, `python`, `none`).
- `GET /api/pastes/:id` returns stored paste JSON or 404 when expired/missing.
- `GET /p/:id` renders the viewer page with Prism highlighting.

Notes: storage is in-memory inside the running container; expired items are cleaned on a 60s interval.
