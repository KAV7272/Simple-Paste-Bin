# Paste Application

Minimal pastebin-style clipboard/pastebin app with syntax highlighting (Prism.js), configurable expirations (10 minutes, 1 hour, 24 hours, 7 days, never), a recent history list, and one-click delete. No auth required—paste, save, and grab it again later.

## Running locally

```bash
npm install
npm start
# open http://localhost:3850
```

## Docker

```bash
docker build -t paste-app .
docker run -p 3850:3850 paste-app
# open http://localhost:3850
```

## API

- `POST /api/pastes` with JSON `{ content, expiresIn, language }` where `expiresIn` is `10m | 1h | 24h | 7d | never` and `language` is a Prism language id (e.g. `javascript`, `python`, `none`).
- `GET /api/pastes` returns the most recent pastes (non-expired), sorted newest first.
- `GET /api/pastes/:id` returns stored paste JSON or 404 when expired/missing.
- `DELETE /api/pastes/:id` removes a paste from history.
- `GET /p/:id` renders the viewer page with Prism highlighting.

Notes: storage is in-memory inside the running container; expired items are cleaned on a 60s interval.
