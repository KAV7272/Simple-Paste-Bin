const path = require("path");
const express = require("express");
const { randomUUID } = require("crypto");

const app = express();
// Default to 3850; override with PORT env if needed.
const PORT = process.env.PORT || 3850;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory store: id -> { content, createdAt, expiresAt }
const pastes = new Map();

const EXPIRATIONS = {
  "10m": 10 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  never: null,
};

function computeExpiry(option) {
  const duration = EXPIRATIONS[option];
  if (duration === undefined) return null;
  if (duration === null) return null;
  return Date.now() + duration;
}

function isExpired(entry) {
  if (!entry) return true;
  if (!entry.expiresAt) return false;
  return Date.now() > entry.expiresAt;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, entry] of pastes) {
    if (entry.expiresAt && now > entry.expiresAt) {
      pastes.delete(id);
    }
  }
}

// Periodic cleanup of expired pastes
setInterval(cleanupExpired, 60 * 1000).unref();

app.get("/p/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "view.html"));
});

app.post("/api/pastes", (req, res) => {
  const { content, expiresIn } = req.body || {};
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Content is required." });
  }

  if (!Object.hasOwn(EXPIRATIONS, expiresIn || "")) {
    return res.status(400).json({ error: "Invalid expiration option." });
  }

  const languageInput = (req.body.language || "none").toString();
  const language = /^[a-z0-9.+-]+$/i.test(languageInput) ? languageInput.toLowerCase() : "none";

  // Use random UUID trimmed for a short, shareable id.
  const id = randomUUID().replace(/-/g, "").slice(0, 10);
  const expiresAt = computeExpiry(expiresIn);
  const entry = {
    id,
    content,
    language,
    expiresIn,
    createdAt: Date.now(),
    expiresAt,
  };

  pastes.set(id, entry);

  res.status(201).json({
    id,
    expiresAt,
    expiresIn,
    language,
    link: `/p/${id}`,
  });
});

app.get("/api/pastes", (req, res) => {
  cleanupExpired();
  const list = Array.from(pastes.values())
    .filter((entry) => !isExpired(entry))
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json(
    list.map((entry) => ({
      id: entry.id,
      content: entry.content,
      language: entry.language,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      expiresIn: entry.expiresIn,
      link: `/p/${entry.id}`,
    }))
  );
});

app.get("/api/pastes/:id", (req, res) => {
  const entry = pastes.get(req.params.id);
  if (!entry || isExpired(entry)) {
    pastes.delete(req.params.id);
    return res.status(404).json({ error: "Paste not found or expired." });
  }

  res.json({
    id: entry.id,
    content: entry.content,
    language: entry.language,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    expiresIn: entry.expiresIn,
  });
});

app.delete("/api/pastes/:id", (req, res) => {
  const entry = pastes.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Paste not found." });
  }
  pastes.delete(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Paste app running at http://localhost:${PORT}`);
});
