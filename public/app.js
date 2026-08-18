(() => {
  const state = {
    token: localStorage.getItem("token") || null,
    user: JSON.parse(localStorage.getItem("user") || "null"),
    isRegisterMode: false,
    chats: [],
    savedChatId: null,
    activeChatId: null,
    activeChatName: null,
    activeChatType: null,   // 'direct' | 'group' | 'channel' | 'saved'
    activeChatHandle: null, // username of the chat partner / group / channel
    ws: null,
    groupModalKind: "group", // 'group' | 'channel'
    profileChatId: null,     // chat currently shown in the profile screen (for "add members")
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

  const meTrigger = document.getElementById("me-trigger");
  const meUsername = document.getElementById("me-username");
  const meAvatar = document.getElementById("me-avatar");
  const themeToggle = document.getElementById("theme-toggle");
  const logoutBtn = document.getElementById("logout-btn");

  const newMenuBtn = document.getElementById("new-menu-btn");
  const newMenu = document.getElementById("new-menu");
  const newGroupBtn = document.getElementById("new-group-btn");
  const newChannelBtn = document.getElementById("new-channel-btn");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const chatsTab = document.getElementById("chats-tab");
  const contactsTab = document.getElementById("contacts-tab");
  const savedItemSlot = document.getElementById("saved-item-slot");

  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const chatListEl = document.getElementById("chat-list");

  const addContactInput = document.getElementById("add-contact-input");
  const addContactBtn = document.getElementById("add-contact-btn");
  const contactsListEl = document.getElementById("contacts-list");

  const emptyState = document.getElementById("empty-state");
  const chatView = document.getElementById("chat-view");
  const chatHeader = document.getElementById("chat-header");
  const chatAvatar = document.getElementById("chat-avatar");
  const chatNameEl = document.getElementById("chat-name");
  const messagesEl = document.getElementById("messages");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");

  const groupModal = document.getElementById("group-modal");
  const groupModalTitle = document.getElementById("group-modal-title");
  const groupNameInput = document.getElementById("group-name");
  const groupHandleInput = document.getElementById("group-handle");
  const groupDescInput = document.getElementById("group-desc");
  const groupMembersInput = document.getElementById("group-members");
  const groupModalError = document.getElementById("group-modal-error");
  const groupCancel = document.getElementById("group-cancel");
  const groupCreate = document.getElementById("group-create");

  const membersModal = document.getElementById("members-modal");
  const membersInput = document.getElementById("members-input");
  const membersModalError = document.getElementById("members-modal-error");
  const membersCancel = document.getElementById("members-cancel");
  const membersAdd = document.getElementById("members-add");

  const profileScreen = document.getElementById("profile-screen");
  const profileBack = document.getElementById("profile-back");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileName = document.getElementById("profile-name");
  const profileHandle = document.getElementById("profile-handle");
  const profileMeta = document.getElementById("profile-meta");
  const profileDesc = document.getElementById("profile-desc");
  const profileGoChat = document.getElementById("profile-go-chat");
  const profileAddContact = document.getElementById("profile-add-contact");
  const profileAddMembers = document.getElementById("profile-add-members");
  const profileSelfSettings = document.getElementById("profile-self-settings");
  const profileThemeSwitch = document.getElementById("profile-theme-switch");
  const profileLogoutBtn = document.getElementById("profile-logout-btn");

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    applyTheme(saved);
  }
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
    themeToggle.textContent = mode === "dark" ? "☀️" : "🌙";
    profileThemeSwitch.checked = mode === "dark";
  }
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
  profileThemeSwitch.addEventListener("change", () => {
    applyTheme(profileThemeSwitch.checked ? "dark" : "light");
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function typeIcon(type) {
    if (type === "group") return " 👥";
    if (type === "channel") return " 📢";
    if (type === "saved") return " 🔖";
    return "";
  }

  // ---------- Auth ----------
  authSwitchLink.addEventListener("click", (e) => {
    e.preventDefault();
    state.isRegisterMode = !state.isRegisterMode;
    authError.textContent = "";
    if (state.isRegisterMode) {
      authTitle.textContent = "ساخت حساب جدید";
      authSub.textContent = "یک آیدی یونیک و رمز عبور انتخاب کنید";
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

  async function doLogout() {
    try { await api("/api/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "/";
  }
  logoutBtn.addEventListener("click", doLogout);
  profileLogoutBtn.addEventListener("click", doLogout);

  // ---------- Enter app ----------
  async function enterApp() {
    authScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    meUsername.textContent = state.user.username;
    meAvatar.textContent = initial(state.user.username);
    await loadSavedChat();
    await loadChats();
    handleInitialRoute();
  }

  // ---------- "New" dropdown menu ----------
  newMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    newMenu.classList.toggle("hidden");
  });
  document.addEventListener("click", () => newMenu.classList.add("hidden"));

  newGroupBtn.addEventListener("click", () => openGroupModal("group"));
  newChannelBtn.addEventListener("click", () => openGroupModal("channel"));

  function openGroupModal(kind) {
    state.groupModalKind = kind;
    groupModalTitle.textContent = kind === "channel" ? "ساخت کانال جدید" : "ساخت گروه جدید";
    groupNameInput.value = "";
    groupHandleInput.value = "";
    groupDescInput.value = "";
    groupMembersInput.value = "";
    groupModalError.textContent = "";
    groupModal.classList.remove("hidden");
  }
  groupCancel.addEventListener("click", () => groupModal.classList.add("hidden"));
  groupCreate.addEventListener("click", async () => {
    const name = groupNameInput.value.trim();
    const username = groupHandleInput.value.trim().replace(/^@/, "");
    const description = groupDescInput.value.trim();
    const members = groupMembersInput.value.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
    groupModalError.textContent = "";
    if (!name || !username) {
      groupModalError.textContent = "نام و آیدی الزامی است";
      return;
    }
    try {
      const endpoint = state.groupModalKind === "channel" ? "/api/chats/channel" : "/api/chats/group";
      const data = await api(endpoint, { method: "POST", body: JSON.stringify({ name, username, description, members }) });
      groupModal.classList.add("hidden");
      await loadChats();
      openChat(data.chatId, data.name, state.groupModalKind, data.username);
    } catch (err) {
      groupModalError.textContent = err.message;
    }
  });

  // ---------- Tabs ----------
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      chatsTab.classList.toggle("hidden", target !== "chats-tab");
      contactsTab.classList.toggle("hidden", target !== "contacts-tab");
      if (target === "contacts-tab") loadContacts();
    });
  });

  // ---------- Saved messages (pinned, shown by default) ----------
  async function loadSavedChat() {
    try {
      const data = await api("/api/chats/saved");
      state.savedChatId = data.chatId;
      savedItemSlot.innerHTML = "";
      const item = document.createElement("div");
      item.className = "chat-item saved-item";
      item.innerHTML = `
        <div class="chat-item-avatar">🔖</div>
        <div class="chat-item-info">
          <div class="chat-item-name">پیام‌های ذخیره‌شده</div>
        </div>
      `;
      item.addEventListener("click", () => openChat(data.chatId, "پیام‌های ذخیره‌شده", "saved", null));
      savedItemSlot.appendChild(item);
    } catch (err) {
      console.error(err);
    }
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
        <div class="chat-item-avatar ${chat.type}">${initial(chat.name)}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escapeHtml(chat.name)}${typeIcon(chat.type)}</div>
          <div class="chat-item-last">${escapeHtml(chat.lastMessage || "پیامی وجود ندارد")}</div>
        </div>
      `;
      item.addEventListener("click", () => openChat(chat.id, chat.name, chat.type, chat.username));
      chatListEl.appendChild(item);
    }
  }

  // ---------- Search users ----------
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim().replace(/^@/, "");
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
          <div class="chat-item-info"><div class="chat-item-name">@${escapeHtml(u.username)}</div></div>
        `;
        item.addEventListener("click", () => {
          searchInput.value = "";
          searchResults.classList.add("hidden");
          showUserProfile(u.username);
        });
        searchResults.appendChild(item);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- Contacts ----------
  async function loadContacts() {
    try {
      const data = await api("/api/contacts");
      contactsListEl.innerHTML = "";
      if (data.contacts.length === 0) {
        const div = document.createElement("div");
        div.style.padding = "20px";
        div.style.color = "var(--text-secondary)";
        div.style.fontSize = "13px";
        div.style.textAlign = "center";
        div.textContent = "دفتر مخاطبین خالی است.";
        contactsListEl.appendChild(div);
        return;
      }
      for (const c of data.contacts) {
        const item = document.createElement("div");
        item.className = "contact-item";
        item.innerHTML = `
          <div class="chat-item-avatar">${initial(c.username)}</div>
          <div class="chat-item-info"><div class="chat-item-name">@${escapeHtml(c.username)}</div></div>
        `;
        item.addEventListener("click", () => showUserProfile(c.username));
        contactsListEl.appendChild(item);
      }
    } catch (err) {
      console.error(err);
    }
  }

  addContactBtn.addEventListener("click", async () => {
    const username = addContactInput.value.trim().replace(/^@/, "");
    if (!username) return;
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify({ username }) });
      addContactInput.value = "";
      loadContacts();
    } catch (err) {
      alert(err.message);
    }
  });

  // ---------- Open chat + websocket ----------
  async function openChat(chatId, name, type, handle) {
    state.activeChatId = chatId;
    state.activeChatName = name;
    state.activeChatType = type;
    state.activeChatHandle = handle || null;

    hideProfileScreen();
    emptyState.classList.add("hidden");
    chatView.classList.remove("hidden");
    chatNameEl.textContent = name;
    chatAvatar.textContent = type === "saved" ? "🔖" : initial(name);
    chatAvatar.className = "chat-header-avatar " + (type || "");
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

  chatHeader.addEventListener("click", () => {
    if (!state.activeChatId) return;
    if (state.activeChatType === "direct" && state.activeChatHandle) {
      showUserProfile(state.activeChatHandle);
    } else if (state.activeChatType === "group" || state.activeChatType === "channel") {
      showChatProfile(state.activeChatHandle, state.activeChatId);
    }
  });

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
      ${!isOut && state.activeChatType !== "direct" && state.activeChatType !== "saved" ? `<span class="msg-sender">${escapeHtml(m.sender_username)}</span>` : ""}
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

  // ---------- Profile screen: self ----------
  meTrigger.addEventListener("click", () => showSelfProfile());

  function showSelfProfile() {
    profileAvatar.className = "profile-avatar";
    profileAvatar.textContent = initial(state.user.username);
    profileName.textContent = state.user.username;
    profileHandle.textContent = "@" + state.user.username;
    profileMeta.textContent = "";
    profileDesc.textContent = "";
    profileGoChat.classList.add("hidden");
    profileAddContact.classList.add("hidden");
    profileAddMembers.classList.add("hidden");
    profileSelfSettings.classList.remove("hidden");
    profileScreen.classList.remove("hidden");
  }

  // ---------- Profile screen: another user ----------
  async function showUserProfile(username) {
    try {
      const data = await api("/api/users/by-username/" + encodeURIComponent(username));
      if (data.isMe) { showSelfProfile(); return; }

      profileAvatar.className = "profile-avatar";
      profileAvatar.textContent = initial(data.username);
      profileName.textContent = data.username;
      profileHandle.textContent = "@" + data.username;
      profileMeta.textContent = "";
      profileDesc.textContent = data.bio || "";
      profileSelfSettings.classList.add("hidden");
      profileAddMembers.classList.add("hidden");

      profileGoChat.classList.remove("hidden");
      profileGoChat.onclick = async () => {
        const chatData = await api("/api/chats/direct", { method: "POST", body: JSON.stringify({ username: data.username }) });
        await loadChats();
        openChat(chatData.chatId, chatData.name, "direct", data.username);
      };

      profileAddContact.classList.remove("hidden");
      profileAddContact.onclick = async () => {
        try {
          await api("/api/contacts", { method: "POST", body: JSON.stringify({ username: data.username }) });
          profileAddContact.textContent = "✅ به مخاطبین اضافه شد";
        } catch (err) {
          alert(err.message);
        }
      };
      profileAddContact.textContent = "➕ افزودن به مخاطبین";

      profileScreen.classList.remove("hidden");
      history.pushState({}, "", "/u/" + encodeURIComponent(data.username));
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Profile screen: group / channel ----------
  async function showChatProfile(username, fallbackChatId) {
    try {
      const path = username
        ? "/api/chats/by-username/" + encodeURIComponent(username)
        : null;
      const data = path ? await api(path) : null;
      if (!data) return;

      state.profileChatId = data.id;

      profileAvatar.className = "profile-avatar " + data.type;
      profileAvatar.textContent = initial(data.name);
      profileName.textContent = data.name + typeIcon(data.type);
      profileHandle.textContent = "@" + data.username;
      profileMeta.textContent = `${data.memberCount} عضو`;
      profileDesc.textContent = data.description || "";
      profileSelfSettings.classList.add("hidden");
      profileAddContact.classList.add("hidden");

      profileGoChat.classList.remove("hidden");
      profileGoChat.onclick = () => openChat(data.id, data.name, data.type, data.username);

      if (data.isOwner) {
        profileAddMembers.classList.remove("hidden");
        profileAddMembers.onclick = () => {
          membersInput.value = "";
          membersModalError.textContent = "";
          membersModal.classList.remove("hidden");
        };
      } else {
        profileAddMembers.classList.add("hidden");
      }

      profileScreen.classList.remove("hidden");
      history.pushState({}, "", "/c/" + encodeURIComponent(data.username));
    } catch (err) {
      alert(err.message);
    }
  }

  membersCancel.addEventListener("click", () => membersModal.classList.add("hidden"));
  membersAdd.addEventListener("click", async () => {
    const members = membersInput.value.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
    if (members.length === 0 || !state.profileChatId) return;
    try {
      await api(`/api/chats/${state.profileChatId}/members`, { method: "POST", body: JSON.stringify({ members }) });
      membersModal.classList.add("hidden");
    } catch (err) {
      membersModalError.textContent = err.message;
    }
  });

  profileBack.addEventListener("click", hideProfileScreen);
  function hideProfileScreen() {
    profileScreen.classList.add("hidden");
    history.pushState({}, "", "/");
  }

  // ---------- Deep-link routing (/u/:username, /c/:username) ----------
  function handleInitialRoute() {
    const pending = sessionStorage.getItem("pendingRoute");
    const path = pending || location.pathname;
    sessionStorage.removeItem("pendingRoute");

    let m = path.match(/^\/u\/([^/]+)$/);
    if (m) { showUserProfile(decodeURIComponent(m[1])); return; }
    m = path.match(/^\/c\/([^/]+)$/);
    if (m) { showChatProfile(decodeURIComponent(m[1])); return; }
  }

  // ---------- Boot ----------
  if (state.token && state.user) {
    enterApp();
  } else if (location.pathname !== "/") {
    // آدرس عمیق زده شده ولی هنوز لاگین نیست؛ بعد از لاگین به همون صفحه برمی‌گردیم
    sessionStorage.setItem("pendingRoute", location.pathname);
  }
})();
