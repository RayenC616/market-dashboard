/* Client-side login gate, shared by index.html / brief.html / archive.html.

   IMPORTANT — this is NOT real security. There is no server here, so these
   credentials (including Admin's) live in plain sight in this file, and any
   page is still directly reachable by URL regardless of login state. This
   only organizes who's using the dashboard and hides UI a given user
   shouldn't need (e.g. the archive button for non-admin users) — it does
   not protect anything from a determined or technical visitor. */

const AUTH_SESSION_KEY = "marketDashboardAuth_v1";

const USERS = {
  "Admin":     { password: "Ku5vZpt5", role: "admin" },
  "FocusAI-1": { password: "feyCMXgX", role: "user" },
  "FocusAI-2": { password: "cr9aFok2", role: "user" },
  "FocusAI-3": { password: "3tdxt9b2", role: "user" },
  "FocusAI-4": { password: "k6rMpfGV", role: "user" },
  "FocusAI-5": { password: "sS4qCpTV", role: "user" },
  "FocusAI-6": { password: "WtNQcgcM", role: "user" },
  "FocusAI-7": { password: "AVizdhuP", role: "user" },
  "FocusAI-8": { password: "bLYEmbYa", role: "user" },
  "FocusAI-9": { password: "PSApEknt", role: "user" },
};

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !USERS[parsed.username]) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function login(username, password) {
  const user = USERS[username];
  if (!user || user.password !== password) return false;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ username, role: user.role }));
  return true;
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  location.reload();
}

function isAdmin() {
  const u = getCurrentUser();
  return !!u && u.role === "admin";
}

/* Renders a full-page login gate into containerEl if no one is logged in,
   and calls onSuccess() immediately (without rendering anything) otherwise.
   On successful login, reloads the page so callers don't need their own
   post-login re-init logic. */
function requireLogin(containerEl, onSuccess) {
  const existing = getCurrentUser();
  if (existing) {
    onSuccess(existing);
    return;
  }

  containerEl.innerHTML = `
    <div class="auth-gate">
      <div class="auth-box">
        <h2>로그인</h2>
        <p class="auth-note">아이디와 비밀번호를 입력하세요.</p>
        <input type="text" id="authUsername" placeholder="아이디 (예: Admin, FocusAI-1)" autocomplete="username">
        <input type="password" id="authPassword" placeholder="비밀번호" autocomplete="current-password">
        <button id="authSubmitBtn">로그인</button>
        <div class="auth-error" id="authError" style="display:none;"></div>
      </div>
    </div>
  `;

  const submit = () => {
    const username = document.getElementById("authUsername").value.trim();
    const password = document.getElementById("authPassword").value;
    if (login(username, password)) {
      location.reload();
    } else {
      const err = document.getElementById("authError");
      err.textContent = "아이디 또는 비밀번호가 올바르지 않습니다.";
      err.style.display = "";
    }
  };

  document.getElementById("authSubmitBtn").onclick = submit;
  containerEl.querySelectorAll("input").forEach(input => {
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  });
}
