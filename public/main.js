const form = document.getElementById("paste-form");
const textarea = document.getElementById("paste");
const expiresSelect = document.getElementById("expiresIn");
const languageSelect = document.getElementById("language");
const resultSection = document.getElementById("result");
const linkInput = document.getElementById("link");
const copyBtn = document.getElementById("copy");
const statusEl = document.getElementById("status");

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
