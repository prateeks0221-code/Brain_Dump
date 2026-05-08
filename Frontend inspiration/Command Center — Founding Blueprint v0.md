# Command Center — Founding Blueprint v0

> *"A founder's diary that became Iron Man's Jarvis."*
>
> Last updated: 25 April 2026 · Owner: Prateek

---

## 1. Why this exists

The venture's vision will likely change two, three, five times. **This product won't.**

Command Center is the foundational utility layer — the place every artifact, idea,
conversation, plan, and reference I've ever cared about lives, in one place, one
call away. If the venture pivots in twelve months, this layer still has every shred
of context to fuel the next bet.

It is built for one user: me. Usability first. No platform thinking. No "what if
1000 users." Version-wise upgrades only as my own usage demands them.

---

## 2. The metaphor — a 3-floor building

```
┌──────────────────────────────────────────────────────┐
│  TOP FLOOR · Connections & Synthesis      (later)    │
│  AI cross-references, "this relates to that",        │
│  detective-style insights surfaced unprompted.       │
├──────────────────────────────────────────────────────┤
│  FIRST FLOOR · Organised Mess              (v1)      │
│  Structured data extracted from raw — OCR on         │
│  screenshots, transcripts of reels, tags, entities.  │
│  Searchable. Indexed. Still a little messy.          │
├──────────────────────────────────────────────────────┤
│  GROUND FLOOR · Raw Dump                   (v0) ◄──  │
│  Pure chaos but real artifacts. Files, links,        │
│  social-media saves, gov docs, chats, plans.         │
│  Categorised into rooms. No smart processing yet.    │
└──────────────────────────────────────────────────────┘
```

**Rule:** never build above a floor that isn't solid. v0 ships only the ground floor.

---

## 3. v0 scope — locked

| Decision         | Choice                                              |
|------------------|-----------------------------------------------------|
| Surface          | Local desktop app (Mac-first)                        |
| Hero view        | Structured rooms (kanban-style boards)               |
| Killer use case  | *"Find that thing I saw three weeks ago."*           |
| Sources          | Files, web links, social-media saves, gov docs, chat exports, founder's diary |
| Out of scope     | AI synthesis, cross-references, automation, sharing  |

If a feature doesn't directly serve **dump-it-fast** or **find-it-fast**, it waits.

---

## 4. The rooms (initial set)

Each room is a wall in the building. Items pinned as cards. New room types are
cheap to add later — but resist. Start with these seven:

1. **Inbox** — the universal dump zone. Every capture lands here first.
2. **Founder's Diary** — plans, strategies, vision, decisions, daily reflections.
3. **Knowledge Vault** — cool tech / ideas captured from LinkedIn, X, Insta reels, articles.
4. **Government & Schemes** — formal docs, programs, regulatory references.
5. **Conversations** — chat exports with knowledge essence (WhatsApp, DMs, etc.).
6. **Files & Docs** — PDFs, screenshots, raw artifacts dropped in.
7. **Web Saves** — bookmarked links with previews.

Triage flow: capture → Inbox → drag to room (or leave; search still works).

---

## 5. The two flows v0 must nail

### A. Dump (zero resistance)
- One global hotkey opens a quick-capture box from anywhere.
- Drag-and-drop a file onto the dock icon → lands in Inbox.
- Paste any URL → scraped to title + preview, lands in Inbox.
- Voice memo → transcribed (later — v0 stores raw audio in Inbox).
- Forward any chat / email screenshot → drop in folder, app picks it up.

### B. Find (in under 10 seconds, three weeks later)
- Global search across filenames, titles, body text, URLs, tags.
- Filter by room, date range, source type.
- Recent + Frequently-opened on home screen.
- Visual: every card shows a thumbnail / preview so the eye recognises it before the brain does.

---

## 6. Tech stack — opinionated v0 picks

The fastest path to a working desktop app the founder can live in within a week:

| Layer        | Pick                          | Why                                                       |
|--------------|-------------------------------|-----------------------------------------------------------|
| Shell        | **Tauri** (or Electron)       | Tauri = smaller, faster; Electron = bigger ecosystem      |
| Frontend     | React + Tailwind              | Fastest UI iteration, no design system needed             |
| Local DB     | **SQLite** (via `better-sqlite3` or Tauri SQL plugin) | Zero ops, owns the file, future-proof |
| Search       | SQLite FTS5                   | Built-in full-text search; good enough for tens of thousands of items |
| File storage | Local `~/CommandCenter/` folder  | User owns the bytes; nothing leaves the machine     |
| Capture API  | Local HTTP server on a port   | Lets a browser extension / mobile shortcut POST in        |

Everything is local. No cloud. No accounts. Backup = sync the folder to iCloud / Drive.

---

## 7. Data model (one screen)

```
Item {
  id            uuid
  type          'file' | 'link' | 'note' | 'screenshot' | 'chat' | 'voice'
  title         string
  body          string?         (extracted text or note content)
  source_url    string?         (original URL if applicable)
  file_path     string?         (relative to ~/CommandCenter/)
  thumbnail     string?         (cached preview)
  room_id       fk → Room
  created_at    timestamp
  captured_via  'dropzone' | 'hotkey' | 'paste' | 'extension' | 'manual'
}

Room {
  id            uuid
  name          string
  emoji         string
  position      int
  is_inbox      bool
}

Tag { id, name }
ItemTag { item_id, tag_id }
```

Done. That's the whole schema for v0.

---

## 8. What this is not (yet)

- Not a note-taking app (Obsidian, Notion, Bear exist)
- Not a bookmark manager (Raindrop, Pocket exist)
- Not a research tool (Readwise, Heptabase exist)
- Not a Zettelkasten

It is the **single intake hopper and instant-recall surface** that sits below all of the above. The differentiator is *coverage* — every source — and *zero-resistance* capture, not a clever organisational philosophy.

---

## 9. The roadmap (for the founder's eyes only)

| Version | Floor       | Theme                          | Trigger to build |
|---------|-------------|--------------------------------|------------------|
| v0      | Ground      | Capture + recall               | Now              |
| v0.5    | Ground      | Browser ext, mobile share-sheet | When 80% of captures still happen on the phone |
| v1      | First       | OCR, transcripts, auto-tags    | When search starts missing screenshots |
| v1.5    | First       | Entity extraction, smart filters | When tags stop scaling |
| v2      | Top         | AI synthesis, "things that relate" | When you start searching for *connections*, not items |

**Rule of progression:** never start the next version until the current one is the
default tool you reach for daily. If you're still opening Notion or Apple Notes for
the same flow, the current version isn't done.

---

## 10. The one principle

> **If capturing takes more than two seconds or finding takes more than ten,
> the product has failed — no matter what else it does.**
