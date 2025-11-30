const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { randomUUID } = require("crypto");

const app = express();
// Default to 3850; override with PORT env if needed.
const PORT = process.env.PORT || 3850;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

let adminPassword = ADMIN_PASSWORD_ENV || null;
let adminUsername = null;

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, "public")));

// In-memory store: id -> { content, createdAt, expiresAt }
const pastes = new Map();
const images = new Map(); // id -> { dataUrl, contentType, createdAt }

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

function isAuthed(req) {
  return req.signedCookies && (req.signedCookies.session === "ok" || req.signedCookies.session === "admin");
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: "Auth required." });
}

app.post("/api/login", (req, res) => {
  const { password, username } = req.body || {};
  const user = typeof username === "string" ? username.trim() : "";
  if (!user) {
    return res.status(400).json({ error: "Username required." });
  }
  // Admin login
  if ((adminPassword && password === adminPassword) || (ADMIN_PASSWORD_ENV && password === ADMIN_PASSWORD_ENV)) {
    adminUsername = adminUsername || user;
    res.cookie("session", "admin", {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookie("username", user, {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
    return res.json({ ok: true, authenticated: true, role: "admin", username: user });
  }

  if (password !== APP_PASSWORD) {
    return res.status(401).json({ error: "Invalid password." });
  }
  res.cookie("session", "ok", {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
  res.cookie("username", user, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
  res.json({ ok: true, authenticated: true, role: "user", username: user });
});

app.post("/api/signup", (req, res) => {
  if (ADMIN_PASSWORD_ENV) {
    return res.status(400).json({ error: "Signup disabled; admin password is configured." });
  }
  if (adminPassword) {
    return res.status(400).json({ error: "Admin already created." });
  }
  const { password, username } = req.body || {};
  const user = typeof username === "string" ? username.trim() : "";
  if (!user) {
    return res.status(400).json({ error: "Username required." });
  }
  if (typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password required (min 4 chars)." });
  }
  adminPassword = password;
  adminUsername = user;
  res.cookie("session", "admin", {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
  res.cookie("username", user, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
  res.json({ ok: true, authenticated: true, role: "admin", username: user });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.clearCookie("username");
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const session = req.signedCookies && req.signedCookies.session;
  const user = req.signedCookies && req.signedCookies.username;
  res.json({
    authenticated: isAuthed(req),
    role: session === "admin" ? "admin" : "user",
    canSignup: !adminPassword && !ADMIN_PASSWORD_ENV,
    username: user || null,
  });
});

// Everything below requires auth if a password is configured
app.use("/api", (req, res, next) => requireAuth(req, res, next));

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

  const languageInput = (req.body.language || "auto").toString();
  const language = languageInput === "auto" ? detectLanguage(content) : /^[a-z0-9.+-]+$/i.test(languageInput) ? languageInput.toLowerCase() : "none";

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

app.post("/api/images", (req, res) => {
  const { dataUrl } = req.body || {};
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return res.status(400).json({ error: "Invalid image data." });
  }
  // rudimentary size guard (~2MB)
  if (dataUrl.length > 2 * 1024 * 1024) {
    return res.status(400).json({ error: "Image too large (limit ~2MB)." });
  }
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  const contentType = match ? match[1] : "application/octet-stream";
  const id = randomUUID().replace(/-/g, "").slice(0, 10);
  const entry = { id, dataUrl, contentType, createdAt: Date.now() };
  images.set(id, entry);
  res.status(201).json(entry);
});

app.get("/api/images", (req, res) => {
  const list = Array.from(images.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

app.delete("/api/images/:id", (req, res) => {
  if (!images.has(req.params.id)) {
    return res.status(404).json({ error: "Image not found." });
  }
  images.delete(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Paste app running at http://localhost:${PORT}`);
});

function detectLanguage(content) {
  const snippet = content.slice(0, 1000);
  const trimmed = snippet.trim();
  const lower = trimmed.toLowerCase();

  const tests = [
    { lang: "json", test: () => (trimmed.startsWith("{") || trimmed.startsWith("[")) && looksJson(trimmed) },
    { lang: "html", test: () => /<\s*html[\s>]/i.test(snippet) || /<\s*(div|span|script|style|body|head)[\s>]/i.test(snippet) },
    { lang: "markdown", test: () => /^#\s|\n#\s|```/.test(snippet) },
    { lang: "python", test: () => /^def\s|\nclass\s|\nif __name__ == ['"]__main__['"]/.test(snippet) },
    { lang: "bash", test: () => /^#!/.test(snippet) || /\bthen\b|\belif\b|\bfi\b/.test(snippet) },
    { lang: "javascript", test: () => /\bfunction\b|\bconst\b|\blet\b|\bexport\b|\bimport\b/.test(snippet) },
    { lang: "typescript", test: () => /\binterface\b|\btype\b|\benum\b/.test(snippet) && /\bexport\b/.test(snippet) },
    { lang: "go", test: () => /\bpackage\s+\w+/.test(snippet) && /\bfunc\s+\w+\(/.test(snippet) },
    { lang: "java", test: () => /\bpublic\s+(class|interface)\b/.test(snippet) },
    { lang: "csharp", test: () => /\bnamespace\b.*\bclass\b/.test(snippet) && /\busing\s+\w+/.test(snippet) },
    { lang: "cpp", test: () => /#include\s+<\w+>/.test(snippet) && /std::/.test(snippet) },
    { lang: "c", test: () => /#include\s+<\w+>/.test(snippet) && /printf\s*\(/.test(snippet) },
    { lang: "ruby", test: () => /\bdef\b.*\n\s+end/.test(snippet) || /\bputs\b/.test(snippet) },
    { lang: "rust", test: () => /\bfn\s+\w+\s*\(/.test(snippet) && /\blet\s+mut\b/.test(snippet) },
    { lang: "sql", test: () => /\bselect\b.+\bfrom\b/i.test(snippet) },
  ];

  for (const t of tests) {
    if (t.test()) return t.lang;
  }
  if (/[{[(].+[)}\]]/.test(snippet) && /;/.test(snippet)) return "javascript";
  if (/^\s*[-*]\s/.test(snippet)) return "markdown";
  return "none";
}

function looksJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
