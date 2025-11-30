const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const loginMsg = document.getElementById("login-msg");

loginBtn.addEventListener("click", async () => {
  await handleAuth("/api/login");
});

signupBtn.addEventListener("click", async () => {
  await handleAuth("/api/signup", true);
});

passwordInput.addEventListener("keyup", async (e) => {
  if (e.key === "Enter") {
    await handleAuth("/api/login");
  }
});

usernameInput.focus();

async function handleAuth(url, isSignup = false) {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  loginMsg.classList.add("hidden");
  if (!username || !password) {
    loginMsg.textContent = "Username and password required.";
    loginMsg.classList.remove("hidden");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Auth failed.");
    }
    window.location.href = "/";
  } catch (err) {
    loginMsg.textContent = err.message;
    loginMsg.classList.remove("hidden");
  }
}

// Disable signup if server disallows it
fetch("/api/session")
  .then((r) => r.json())
  .then((data) => {
    if (!data.canSignup) {
      signupBtn.disabled = true;
      signupBtn.title = "Admin already exists or signup disabled.";
    }
  })
  .catch(() => {});
