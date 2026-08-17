````md
# DIDIGRAM

A web-based messenger inspired closely by Telegram Web, built to run on Cloudflare.

## Project Status

**Current phase:** Initial setup / GitHub repository prepared manually

**Repository:** `DIDIGRAME`

**Project name:** DIDIGRAM

---

## What We Decided

DIDIGRAM is a web-based messaging application with a UI closely inspired by Telegram Web.

### Core Features

- [ ] User registration
- [ ] Login / logout
- [ ] Username
- [ ] Display name
- [ ] Password hashing
- [ ] Persistent user accounts
- [ ] User search by username
- [ ] Private 1-to-1 chats
- [ ] Group chats
- [ ] Group members
- [ ] Group administration
- [ ] Real-time messaging
- [ ] WebSocket connection
- [ ] Online / offline status
- [ ] Last seen
- [ ] Typing indicator
- [ ] Read / seen status
- [ ] Message timestamps
- [ ] Reply to messages
- [ ] Edit messages
- [ ] Delete messages
- [ ] Chat list
- [ ] Message search
- [ ] Dark theme
- [ ] Light theme
- [ ] Responsive desktop/mobile UI

### Explicitly Excluded From V1

The first version focuses only on text chat.

- [ ] Image uploads
- [ ] File uploads
- [ ] Voice messages
- [ ] Video messages

These may be added in a future version.

---

# Planned Architecture

```text
Browser
   |
   v
Cloudflare Worker
   |
   +-- D1 Database
   |     +-- users
   |     +-- sessions
   |     +-- chats
   |     +-- chat_members
   |     +-- messages
   |     +-- groups
   |     +-- group_members
   |
   +-- Durable Objects
         +-- WebSocket / Real-time messaging
````

## Cloudflare Services

* **Cloudflare Workers** — Application backend and API
* **Cloudflare D1** — Relational application data
* **Cloudflare Durable Objects** — Real-time WebSocket/state coordination
* **R2** — Not required for V1

R2 will only be introduced if file/image uploads are added later.

---

# Security Requirements

Security must be treated as a core part of the application.

## Passwords

Passwords must never be stored as plaintext.

```text
User password
     |
     v
Password hashing
     |
     v
password_hash stored in D1
```

Do not store passwords in:

* LocalStorage
* SessionStorage
* Client-side JavaScript
* Plaintext database fields

## Sessions

Authentication should use secure server-managed sessions.

Cookies should use appropriate security attributes such as:

* `HttpOnly`
* `Secure`
* `SameSite`

Session expiration and invalidation must be implemented on the server.

---

# UI Direction

The interface should be a close visual interpretation of Telegram Web.

The goal is to reproduce the familiar layout and interaction patterns without unnecessarily copying proprietary assets.

## Main Layout

```text
+-------------------+--------------------------------------+
| Search            | Chat header                          |
+-------------------+--------------------------------------+
| Chat 1            |                                      |
| Chat 2            |          Message history             |
| Chat 3            |                                      |
| Chat 4            |                                      |
|                   |--------------------------------------|
|                   | Message input                        |
+-------------------+--------------------------------------+
```

## Themes

* Light mode
* Dark mode
* Theme preference should persist between sessions

## Responsive Behavior

Desktop:

```text
Chat list | Conversation
```

Mobile:

```text
Chat list
    |
    v
Conversation
```

---

# Database Design

## Users

```text
users
- id
- username
- password_hash
- display_name
- avatar_url
- created_at
- last_seen
```

## Sessions

```text
sessions
- id
- user_id
- expires_at
- created_at
```

## Chats

```text
chats
- id
- type
- created_at
```

## Chat Members

```text
chat_members
- chat_id
- user_id
- joined_at
```

## Messages

```text
messages
- id
- chat_id
- sender_id
- content
- reply_to
- created_at
- edited_at
- deleted_at
```

## Groups

```text
groups
- id
- name
- description
- owner_id
- created_at
```

## Group Members

```text
group_members
- group_id
- user_id
- role
- joined_at
```

The exact database schema may be adjusted during implementation.

---

# Work Completed In This Chat

## 1. Product Definition

Defined the project as:

**DIDIGRAM**

A web-based messenger with a Telegram Web-inspired UI.

## 2. Authentication

Account creation will require:

* Username
* Password

The application will also have:

* Display Name

Passwords will be hashed before being stored.

## 3. Messaging

Planned:

* Private conversations
* Groups
* User search
* Real-time messaging
* Online status
* Typing indicator
* Seen status
* Reply
* Edit
* Delete

## 4. UI

Decided on:

* Telegram Web-inspired interface
* Dark theme
* Light theme
* Desktop support
* Mobile responsive design

## 5. File Handling

V1 does not need:

* Images
* Files
* Voice messages

Therefore R2 is intentionally excluded from the first version.

## 6. Cloudflare Architecture

Planned:

* Cloudflare Workers
* Cloudflare D1
* Cloudflare Durable Objects
* WebSockets

## 7. GitHub

The user manually created the repository:

```text
DIDIGRAME
```

The repository should remain clean until implementation begins.

---

# Development Roadmap

## Phase 1 — Repository Setup

* [ ] Inspect `DIDIGRAME`
* [ ] Create project structure
* [ ] Add package configuration
* [ ] Add Wrangler configuration
* [ ] Add `.gitignore`
* [ ] Add initial README
* [ ] Create first commit

Suggested structure:

```text
DIDIGRAME/
├── src/
│   ├── worker.js
│   ├── auth.js
│   ├── users.js
│   ├── chats.js
│   ├── groups.js
│   └── realtime.js
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── migrations/
│   └── 0001_initial.sql
│
├── wrangler.jsonc
├── package.json
├── README.md
└── .gitignore
```

---

# Phase 2 — Database

Create the D1 database schema for:

* Users
* Sessions
* Chats
* Chat members
* Messages
* Groups
* Group members

Tasks:

* [ ] Create migration
* [ ] Create tables
* [ ] Add primary keys
* [ ] Add foreign keys
* [ ] Add indexes
* [ ] Add username uniqueness constraint
* [ ] Test database queries

---

# Phase 3 — Authentication

Implement:

* [ ] Registration
* [ ] Username uniqueness
* [ ] Password hashing
* [ ] Login
* [ ] Session creation
* [ ] Logout
* [ ] Session expiration
* [ ] Authentication middleware
* [ ] Basic abuse/rate-limit protection

---

# Phase 4 — User System

Implement:

* [ ] User profile
* [ ] Display name
* [ ] Username
* [ ] Username search
* [ ] Online status
* [ ] Last seen
* [ ] Start private chat from search

---

# Phase 5 — Private Chat

Implement:

* [ ] Create private chat
* [ ] Load chat history
* [ ] Send messages
* [ ] Receive messages
* [ ] Message timestamps
* [ ] Reply
* [ ] Edit
* [ ] Delete
* [ ] Read status

---

# Phase 6 — Real-Time System

Implement:

* [ ] Durable Object
* [ ] WebSocket connection
* [ ] WebSocket authentication
* [ ] Real-time message delivery
* [ ] Typing indicator
* [ ] Online presence
* [ ] Reconnection handling
* [ ] Multiple browser tabs
* [ ] Message ordering

---

# Phase 7 — Groups

Implement:

* [ ] Create group
* [ ] Group name
* [ ] Group description
* [ ] Add users
* [ ] Remove users
* [ ] Leave group
* [ ] Group owner
* [ ] Group administrators
* [ ] Group messaging

---

# Phase 8 — Frontend

Build a Telegram Web-inspired interface.

### Pages / Views

* [ ] Login
* [ ] Registration
* [ ] Main messenger
* [ ] Chat sidebar
* [ ] Conversation view
* [ ] User search
* [ ] Group creation
* [ ] Profile
* [ ] Settings

### Components

* [ ] Chat list
* [ ] Message bubbles
* [ ] Message input
* [ ] Chat header
* [ ] User search
* [ ] Group member list
* [ ] Context menu
* [ ] Reply UI
* [ ] Edit UI
* [ ] Delete confirmation
* [ ] Online indicator

### Themes

* [ ] Dark mode
* [ ] Light mode
* [ ] Persistent theme preference

### Responsive Design

* [ ] Desktop layout
* [ ] Tablet layout
* [ ] Mobile layout

---

# Phase 9 — Testing

Test:

* [ ] Registration
* [ ] Duplicate usernames
* [ ] Invalid login
* [ ] Session expiration
* [ ] Private messaging
* [ ] Group messaging
* [ ] Multiple users simultaneously
* [ ] WebSocket reconnection
* [ ] Message ordering
* [ ] Message editing
* [ ] Message deletion
* [ ] Read status
* [ ] Mobile UI
* [ ] Desktop UI
* [ ] Dark mode
* [ ] Light mode
* [ ] Authorization edge cases
* [ ] Security edge cases

---

# Phase 10 — Cloudflare Deployment

After application validation:

* [ ] Create D1 database
* [ ] Apply migrations
* [ ] Configure Worker
* [ ] Configure Durable Objects
* [ ] Configure production environment
* [ ] Configure secrets
* [ ] Deploy Worker
* [ ] Test production WebSocket
* [ ] Test production authentication
* [ ] Configure production domain if desired

---

# Phase 11 — Post-V1 Features

Only after V1 is stable:

* [ ] Image messages
* [ ] File messages
* [ ] Voice messages
* [ ] Message reactions
* [ ] Pin messages
* [ ] Mute chats
* [ ] Block users
* [ ] Forward messages
* [ ] Notifications
* [ ] Advanced message search
* [ ] Multi-device improvements
* [ ] End-to-End Encryption

---

# Important Development Rules

1. Keep V1 focused on text messaging.
2. Do not add unnecessary infrastructure.
3. Never store plaintext passwords.
4. Never expose secrets in frontend code.
5. Validate authorization on the server.
6. Never trust client-provided user IDs.
7. Validate every message operation against chat membership.
8. Use parameterized database queries.
9. Handle WebSocket reconnection.
10. Build mobile responsiveness from the beginning.
11. Do not sacrifice security for visual similarity to Telegram.
12. Do not add R2 until file uploads are actually required.
13. Keep the code modular and maintainable.
14. Avoid unnecessary dependencies.
15. Test each major feature before moving to the next phase.

---

# Current Next Action

The next implementation step is:

**Inspect the `DIDIGRAME` GitHub repository and create the initial DIDIGRAM project structure.**

Then:

```text
Repository
   ↓
Project skeleton
   ↓
D1 schema
   ↓
Authentication
   ↓
Private chat
   ↓
Real-time WebSocket
   ↓
Groups
   ↓
Telegram-style UI
   ↓
Testing
   ↓
Cloudflare deployment
```

The README should be updated whenever a major milestone is completed.

```
```
