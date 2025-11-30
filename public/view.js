const codeEl = document.getElementById("code");
const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");

async function loadPaste() {
  const id = window.location.pathname.split("/").pop();
  try {
    const res = await fetch(`/api/pastes/${id}`);
    if (!res.ok) {
      throw new Error("Paste not found or expired.");
    }
    const paste = await res.json();
    codeEl.textContent = paste.content;
    codeEl.className = `language-${paste.language || "none"}`;
    titleEl.textContent = `Paste #${paste.id}`;
    metaEl.textContent = paste.expiresAt
      ? `Created ${new Date(paste.createdAt).toLocaleString()} · Expires ${new Date(paste.expiresAt).toLocaleString()}`
      : `Created ${new Date(paste.createdAt).toLocaleString()} · Never expires`;
    Prism.plugins.autoloader.languages_path = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";
    Prism.highlightElement(codeEl);
  } catch (err) {
    titleEl.textContent = "Unavailable";
    metaEl.textContent = err.message;
    codeEl.textContent = "";
  }
}

loadPaste();
