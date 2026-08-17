(() => {
  const state = {
    token: localStorage.getItem("token") || null,
    user: JSON.parse(localStorage.getItem("user") || "null"),
    isRegisterMode: false,
    chats: [],
    activeChatId: null,
    activeChatName: null,
    ws: null,
  };

  // ---------- DOM refs ----------
  const authScreen = document.getElementById("auth-screen");
  const appEl = document.getElementById("app");
  const authForm = document.getElementById("auth-form");
  const authTitle = document.getElementById("auth-title");
  const authSub = document.getElementById("auth-sub");
  const authSubmit = document.getElementById("auth-submit");
  const authError = document.getElementById("auth-error");
  const authSwitchText = document.getElementById("auth-switch-text");
  const authSwitchLink = document.getElementById("auth-switch-link");
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");

  const meUsername = document.getElementById("me-username");
  const meAvatar = document.getElementById("me-avatar");
  const themeToggle = document.getElementById("theme-toggle");
  const logoutBtn = document.getElementById("logout-btn");
  const newGroupBtn = document.getElementById("new-group-btn");

  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const chatListEl = document.getElementById("chat-list");

  const emptyState = document.getElementById("empty-state");
  const chatView = document.getElementById("chat-view");
  const chatAvatar = document.getElementById("chat-avatar");
  const chatNameEl = document.getElementById("chat-name");
  const messagesEl = document.getElementById("messages");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");

  const groupModal = document.getElementById("group-modal");
  const groupNameInput = document.getElementById("group-name");
  const groupMembersInput = document.getElementById("group-members");
  const groupCancel = document.getElementById("group-cancel");
  const groupCreate = document.getElementById("group-create");

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    themeToggle.textContent = saved === "dark" ? "☀️" : "🌙";
  }
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
  });
  initTheme();

  // ---------- API helper ----------
  async function api(path, options = {}) {
    const headers = options.headers || {};
    if (state.token) headers["Authorization"] = "Bearer " + state.token;
    if (options.body) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "خطای ناشناخته");
    return data;
  }

  function initial(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  // ---------- Auth ----------
  authSwitchLink.addEventListener("click", (e) => {
    e.preventDefault();
    state.isRegisterMode = !state.isRegisterMode;
    authError.textContent = "";
    if (state.isRegisterMode) {
      authTitle.textContent = "ساخت حساب جدید";
      authSub.textContent = "یک نام کاربری و رمز عبور انتخاب کنید";
      authSubmit.textContent = "ثبت‌نام";
      authSwitchText.textContent = "قبلاً حساب دارید؟";
      authSwitchLink.textContent = "وارد شوید";
    } else {
      authTitle.textContent = "ورود به حساب";
      authSub.textContent = "برای شروع گفتگو وارد شوید";
      authSubmit.textContent = "ورود";
      authSwitchText.textContent = "حساب ندارید؟";
      authSwitchLink.textContent = "ثبت‌نام کنید";
    }
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const endpoint = state.isRegisterMode ? "/api/register" : "/api/login";
    try {
      authSubmit.disabled = true;
      const data = await api(endpoint, { method: "POST", body: JSON.stringify({ username, password }) });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("token", state.token);
      localStorage.setItem("user", JSON.stringify(state.user));
      enterApp();
    } catch (err) {
      authError.textContent = err.message;
    } finally {
      authSubmit.disabled = false;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.reload();
  });

  // ---------- Enter app ----------
  function enterApp() {
    authScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    meUsername.textContent = state.user.username;
    meAvatar.textContent = initial(state.user.username);
    loadChats();
  }

  // ---------- Chat list ----------
  async function loadChats() {
    try {
      const data = await api("/api/chats");
      state.chats = data.chats;
      renderChatList();
    } catch (err) {
      console.error(err);
    }
  }

  function renderChatList() {
    chatListEl.innerHTML = "";
    if (state.chats.length === 0) {
      const div = document.createElement("div");
      div.style.padding = "20px";
      div.style.color = "var(--text-secondary)";
      div.style.fontSize = "13px";
      div.style.textAlign = "center";
      div.textContent = "هنوز چتی نداری. یک کاربر را جستجو کن!";
      chatListEl.appendChild(div);
      return;
    }
    for (const chat of state.chats) {
      const item = document.createElement("div");
      item.className = "chat-item" + (chat.id === state.activeChatId ? " active" : "");
      item.innerHTML = `
        <div class="chat-item-avatar">${initial(chat.name)}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escapeHtml(chat.name)}${chat.type === "group" ? " 👥" : ""}</div>
          <div class="chat-item-last">${escapeHtml(chat.lastMessage || "پیامی وجود ندارد")}</div>
        </div>
      `;
      item.addEventListener("click", () => openChat(chat.id, chat.name));
      chatListEl.appendChild(item);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ---------- Search users ----------
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (!q) {
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
      return;
    }
    searchTimeout = setTimeout(() => doSearch(q), 250);
  });

  async function doSearch(q) {
    try {
      const data = await api("/api/users/search?q=" + encodeURIComponent(q));
      searchResults.innerHTML = "";
      if (data.users.length === 0) {
        searchResults.classList.add("hidden");
        return;
      }
      searchResults.classList.remove("hidden");
      for (const u of data.users) {
        const item = document.createElement("div");
        item.className = "search-item";
        item.innerHTML = `
          <div class="chat-item-avatar">${initial(u.username)}</div>
          <div class="chat-item-info"><div class="chat-item-name">${escapeHtml(u.username)}</div></div>
        `;
        item.addEventListener("click", async () => {
          searchInput.value = "";
          searchResults.classList.add("hidden");
          const data = await api("/api/chats/direct", {
            method: "POST",
            body: JSON.stringify({ username: u.username }),
          });
          await loadChats();
          openChat(data.chatId, data.name);
        });
        searchResults.appendChild(item);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- Group creation ----------
  newGroupBtn.addEventListener("click", () => {
    groupNameInput.value = "";
    groupMembersInput.value = "";
    groupModal.classList.remove("hidden");
  });
  groupCancel.addEventListener("click", () => groupModal.classList.add("hidden"));
  groupCreate.addEventListener("click", async () => {
    const name = groupNameInput.value.trim();
    const members = groupMembersInput.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name) return;
    try {
      const data = await api("/api/chats/group", {
        method: "POST",
        body: JSON.stringify({ name, members }),
      });
      groupModal.classList.add("hidden");
      await loadChats();
      openChat(data.chatId, data.name);
    } catch (err) {
      alert(err.message);
    }
  });

  // ---------- Open chat + websocket ----------
  async function openChat(chatId, name) {
    state.activeChatId = chatId;
    state.activeChatName = name;
    emptyState.classList.add("hidden");
    chatView.classList.remove("hidden");
    chatNameEl.textContent = name;
    chatAvatar.textContent = initial(name);
    document.getElementById("app").classList.add("chat-open");
    renderChatList();

    messagesEl.innerHTML = "";
    try {
      const data = await api(`/api/chats/${chatId}/messages`);
      for (const m of data.messages) appendMessage(m);
      scrollToBottom();
    } catch (err) {
      console.error(err);
    }

    connectWebSocket(chatId);
  }

  function connectWebSocket(chatId) {
    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws/${chatId}?token=${encodeURIComponent(state.token)}`;
    const ws = new WebSocket(url);
    state.ws = ws;

    ws.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message" && data.message.chatId === state.activeChatId) {
        appendMessage({
          id: data.message.id,
          sender_id: data.message.senderId,
          sender_username: data.message.senderUsername,
          content: data.message.content,
          created_at: data.message.createdAt,
        });
        scrollToBottom();
        loadChats();
      }
    });
  }

  function appendMessage(m) {
    const isOut = m.sender_id === state.user.id;
    const div = document.createElement("div");
    div.className = "msg " + (isOut ? "out" : "in");
    div.dir = "auto";
    const time = new Date(m.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `
      ${!isOut ? `<span class="msg-sender">${escapeHtml(m.sender_username)}</span>` : ""}
      <span>${escapeHtml(m.content)}</span>
      <span class="msg-time">${time}</span>
    `;
    messagesEl.appendChild(div);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type: "message", content }));
    messageInput.value = "";
  });

  // ---------- Boot ----------
  if (state.token && state.user) {
    enterApp();
  }
})();
