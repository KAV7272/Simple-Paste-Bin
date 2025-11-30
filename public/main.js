const form = document.getElementById("paste-form");
const textarea = document.getElementById("paste");
const expiresSelect = document.getElementById("expiresIn");
const loginPanel = document.getElementById("login-panel");
const loginInput = document.getElementById("login-password");
const loginSubmit = document.getElementById("login-submit");
const loginError = document.getElementById("login-error");
const themeToggle = document.getElementById("theme-toggle");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const refreshHistoryBtn = document.getElementById("refresh-history");
const imageInput = document.getElementById("image-input");
const imageUploadBtn = document.getElementById("image-upload");
const imageList = document.getElementById("image-list");
const imageEmpty = document.getElementById("image-empty");

let historyData = new Map();
let authenticated = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authenticated) {
    await ensureAuth();
    return;
  }

  const content = textarea.value.trim();
  const expiresIn = expiresSelect.value;
  if (!content) {
    showStatus("Paste cannot be empty.");
    return;
  }

  try {
    const response = await fetch("/api/pastes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, expiresIn, language: "auto" }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || "Failed to save paste.");
    }

    textarea.value = "";
    showStatus("Saved.");
    await loadHistory();
  } catch (err) {
    showStatus(err.message);
  }
});

refreshHistoryBtn.addEventListener("click", loadHistory);
imageUploadBtn.addEventListener("click", async () => {
  if (!authenticated) {
    await ensureAuth();
    return;
  }
  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    showStatus("Pick an image to upload.");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Upload failed.");
    }
    imageInput.value = "";
    await Promise.all([loadHistory(), loadImages()]);
  } catch (err) {
    showStatus(err.message || "Upload failed.");
  }
});

historyList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const paste = historyData.get(id);
  if (!paste) return;

  if (action === "copy") {
    const ok = await copyToClipboard(paste.content);
    btn.textContent = ok ? "Copied!" : "Copy failed";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  }

  if (action === "delete") {
    btn.disabled = true;
    try {
      await fetch(`/api/pastes/${id}`, { method: "DELETE" });
      await loadHistory();
    } catch (err) {
      btn.disabled = false;
    }
  }
});

imageList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === "delete") {
    btn.disabled = true;
    try {
      await fetch(`/api/images/${id}`, { method: "DELETE" });
      await loadImages();
    } catch (err) {
      btn.disabled = false;
    }
  }
  if (action === "copy") {
    const item = btn.closest("li");
    const dataUrl = item?.dataset.url;
    if (!dataUrl) return;
    const ok = await copyImageToClipboard(dataUrl);
    btn.textContent = ok ? "Copied!" : "Copy failed";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  }
});

loginSubmit.addEventListener("click", async () => {
  await login();
});

loginInput.addEventListener("keyup", async (e) => {
  if (e.key === "Enter") {
    await login();
  }
});

themeToggle.addEventListener("click", () => {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  document.body.dataset.theme = next;
  localStorage.setItem("theme", next);
});

function showStatus(text) {
  historyEmpty.textContent = text;
  historyEmpty.classList.remove("hidden");
}

async function loadHistory() {
  if (!authenticated) return;
  try {
    const res = await fetch("/api/pastes");
    if (!res.ok) throw new Error("Failed to load history.");
    const data = await res.json();
    historyData = new Map();
    historyList.innerHTML = "";

    if (!data.length) {
      historyEmpty.textContent = "No saved copies yet.";
      historyEmpty.classList.remove("hidden");
      return;
    }

    historyEmpty.classList.add("hidden");

    data.forEach((paste) => {
      historyData.set(paste.id, paste);
      const li = document.createElement("li");
      li.className = "history__item";

      const meta = document.createElement("div");
      meta.className = "history__meta";
      meta.innerHTML = `<span>#${paste.id}</span><span class="pill">${paste.language || "none"}</span><span>${formatDate(paste.createdAt)}</span><span>${formatExpiry(paste)}</span>`;

      const preview = document.createElement("div");
      preview.className = "history__preview";
      preview.textContent = paste.content.slice(0, 400);
  if (paste.content.length > 400) preview.textContent += "…";

  const actions = document.createElement("div");
  actions.className = "history__actions";
  actions.innerHTML = `
        <button class="ghost" data-action="copy" data-id="${paste.id}">Copy</button>
        <button class="danger" data-action="delete" data-id="${paste.id}">Delete</button>
      `;

      li.append(meta, preview, actions);
      historyList.appendChild(li);
    });
  } catch (err) {
    historyEmpty.textContent = err.message;
    historyEmpty.classList.remove("hidden");
  }
}

async function loadImages() {
  if (!authenticated) return;
  try {
    const res = await fetch("/api/images");
    if (!res.ok) throw new Error("Failed to load images.");
    const data = await res.json();
    imageList.innerHTML = "";
    if (!data.length) {
      imageEmpty.textContent = "No images yet.";
      imageEmpty.classList.remove("hidden");
      return;
    }
    imageEmpty.classList.add("hidden");

    data.forEach((img) => {
      const li = document.createElement("li");
      li.className = "history__item";
      li.dataset.url = img.dataUrl;
      const meta = document.createElement("div");
      meta.className = "history__meta";
      meta.innerHTML = `<span>#${img.id}</span><span>${formatDate(img.createdAt)}</span>`;

      const preview = document.createElement("div");
      preview.className = "history__image";
      const imageEl = document.createElement("img");
      imageEl.src = img.dataUrl;
      imageEl.alt = "Saved image";
      preview.appendChild(imageEl);

      const actions = document.createElement("div");
      actions.className = "history__actions";
      actions.innerHTML = `
        <button class="ghost" data-action="copy" data-id="${img.id}">Copy</button>
        <button class="danger" data-action="delete" data-id="${img.id}">Delete</button>
      `;

      li.append(meta, preview, actions);
      imageList.appendChild(li);
    });
  } catch (err) {
    imageEmpty.textContent = err.message;
    imageEmpty.classList.remove("hidden");
  }
}

async function ensureAuth() {
  const res = await fetch("/api/session");
  const data = await res.json();
  authenticated = !!data.authenticated;
  if (authenticated) {
    loginPanel.classList.add("hidden");
    form.classList.remove("hidden");
    await Promise.all([loadHistory(), loadImages()]);
  } else {
    loginPanel.classList.remove("hidden");
    form.classList.add("hidden");
  }
}

async function login() {
  const password = loginInput.value;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Login failed.");
    }
    authenticated = true;
    loginError.classList.add("hidden");
    loginPanel.classList.add("hidden");
    form.classList.remove("hidden");
    await loadHistory();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
}

function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    document.body.dataset.theme = saved;
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers/denied permissions
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    return true;
  } catch (err) {
    console.error("Copy failed", err);
    return false;
  }
}

async function copyImageToClipboard(dataUrl) {
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    }
    // Fallback: trigger download
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "image.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.error("Image copy failed", err);
    return false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

function formatExpiry(paste) {
  return paste.expiresAt ? `Expires ${formatDate(paste.expiresAt)}` : "Never expires";
}

applySavedTheme();
ensureAuth();
