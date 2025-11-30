const form = document.getElementById("paste-form");
const textarea = document.getElementById("paste");
const expiresSelect = document.getElementById("expiresIn");
const languageSelect = document.getElementById("language");
const resultSection = document.getElementById("result");
const linkInput = document.getElementById("link");
const copyBtn = document.getElementById("copy");
const statusEl = document.getElementById("status");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const refreshHistoryBtn = document.getElementById("refresh-history");

let historyData = new Map();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = textarea.value.trim();
  const expiresIn = expiresSelect.value;
  if (!content) {
    statusEl.textContent = "Paste cannot be empty.";
    resultSection.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch("/api/pastes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, expiresIn, language: languageSelect.value }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || "Failed to save paste.");
    }

    const data = await response.json();
    const absoluteLink = `${window.location.origin}${data.link}`;
    linkInput.value = absoluteLink;
    statusEl.textContent = data.expiresAt ? `Expires ${new Date(data.expiresAt).toLocaleString()}` : "Never expires";
    resultSection.classList.remove("hidden");
    await loadHistory();
  } catch (err) {
    statusEl.textContent = err.message;
    resultSection.classList.remove("hidden");
  }
});

copyBtn.addEventListener("click", async () => {
  if (!linkInput.value) return;
  await navigator.clipboard.writeText(linkInput.value);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
});

refreshHistoryBtn.addEventListener("click", loadHistory);

historyList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const paste = historyData.get(id);
  if (!paste) return;

  if (action === "copy") {
    await navigator.clipboard.writeText(paste.content);
    btn.textContent = "Copied!";
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

async function loadHistory() {
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
        <a class="ghost" href="${paste.link}" target="_blank" rel="noopener">Open</a>
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

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

function formatExpiry(paste) {
  return paste.expiresAt ? `Expires ${formatDate(paste.expiresAt)}` : "Never expires";
}

loadHistory();
