# ROOM INTERFACE — Cinematic Landing Page / UX Spec
## "The Memory Palace for Digital Work"

---

## CORE CONCEPT

A spatial productivity interface that rejects the dopamine-feed of modern apps. The entire UX is metaphorically and literally a room you enter. The room has structure — walls, a table, a door, light. You don't "use" this interface. You walk into it.

**The philosophical stance:** Your inbox is not your workspace. It's the messy table by the door. Your work lives on the walls. The interface enforces this separation — loudly.

---

## THE ENTRY SEQUENCE (Cinematic Reveal)

### Frame 1: The Pin (0.0s — 1.5s)
- Screen: absolute black `#0a0a0c`
- A single warm amber point of light appears center frame
- This is the last card the user touched — their point of re-entry into memory
- The light breathes — subtle pulse at 0.5Hz, like a slow heartbeat
- No text. No buttons. Just a point of attention in infinite space.

### Frame 2: The Pull Back (1.5s — 4.0s)
- Camera begins a slow, breath-like retreat
- The single card reveals itself — translucent, glowing warm edges, floating
- Behind it, out of focus: other cards emerge like embers from darkness
- Bokeh depth of field — razor thin at first, slowly deepening
- Atmospheric dust particles catch the warm light
- The feeling: "I am not loading an app. I am arriving somewhere."

### Frame 3: The Architecture Revealed (4.0s — 7.5s)
- Camera continues pulling back to reveal the full room
- Nine corkboard walls radiate in a gentle arc/circle
- Each wall is individually lit by warm tungsten spots from above
- Names burned into wooden headers at top of each wall:
  - WAR ROOM
  - SWIPE
  - INTEL
  - PLAYBOOKS
  - LEVERAGE
  - TECH
  - VOICES
  - CONVERSATIONS
  - MISC
- The walls are cork texture. Real materiality. Not flat UI.
- Center frame: the long raw wooden table — the inbox

### Frame 4: The Room Stabilizes (7.5s — 10.0s)
- Camera settles into a "standing at the doorway" POV
- Soft ambient motion: cards gently drift/float with micro-movements
- Lighting fully established — warm, theatrical, directional
- The TODO_TONIGHT board glows subtly near the door frame at eye level
- Total absence of: blue light, notification badges, red dots, numbers, scrolling feeds

---

## SPATIAL ARCHITECTURE

### THE TABLE (inbox/)
- **Location:** Center of room, or immediately visible upon entry
- **State:** Intentionally messy. Always messy during the day.
- **Contents:** Screenshots, scribbled notes, printed tweets, voice memo cassettes, torn newspaper bits, unread links, dumped thoughts
- **Behavior:** 
  - Items land here automatically from external inputs
  - They pile, they overlap, they nag visually
  - User must deliberately move items from table to walls
  - No auto-sorting. No AI cleanup. The mess is the point — it's a to-do list you can feel.
- **Lighting:** Single tungsten spot from above. The rest of the room is darker. The table is where chaos lives, contained.

### THE WALLS
- **Location:** Nine walls surrounding the space
- **Material:** Corkboard with real texture. Pins cast tiny shadows.
- **Headers:** Woodburned names. Imperfect. Human.
- **Contents:** Cards, photos, sticky notes, strings connecting related items (on some walls)
- **Sub-shelves:** Some walls have nested zones (e.g., pricing/, landing_pages/)
- **Behavior:**
  - Items on walls are deliberately placed by the user
  - They stay where put. No algorithmic reordering.
  - Long-press or drag to re-pin elsewhere
  - Walls can be "walked to" — click/enter zooms into that wall
  - Related items can be connected with red string (manual or suggested)

### TODO_TONIGHT Board
- **Location:** Near the door, eye-level, small and intimate
- **Capacity:** 3–5 cards maximum. Enforced ruthlessly.
- **Purpose:** The only thing visible when leaving. The only thing visible when returning.
- **Behavior:**
  - User "leaves" the room when TODO_TONIGHT has 3–5 fresh cards
  - Cards can be pulled from any wall or the table
  - If full, user must complete or return a card before adding new
  - This is the commitment mechanism — the door won't let you leave empty-handed

---

## USER FLOW (Revised with Pre-Wall Cleaning)

Since dump-cleaning happens *before* data reaches the walls, the flow is:

1. **User enters room** → sees TODO_TONIGHT first, then table
2. **Glance at TODO_TONIGHT** → refresh memory of next move
3. **Glance at table** → mentally note volume (heavy day or light?)
4. **Choose path:**
   - **Work the table:** Sort 5 items. For each item — read, decide, pin to a wall, or delete. This is the cleaning step.
   - **Walk to a wall:** Look up something already processed and pinned.
5. **Leave when** TODO_TONIGHT has 3–5 fresh cards

**The cleaning ritual is the gateway.** Nothing reaches the walls without passing through your hands. The walls are curated. The table is raw.

---

## SENSORY DESIGN

### Color Palette
| Element | Value |
|---------|-------|
| Deep void | `#0a0a0c` |
| Warm wood | `#8B6F4E` |
| Cork board | `#C4A882` |
| Amber glow | `#FFB347` |
| Cream card | `#F5F0E8` |
| Tungsten light | `#FFF3E0` |
| Red string | `#C75B39` |
| Shadow depth | `#050505` |

**Rule:** No blue light anywhere. No `#0066FF`, no `#00D4AA`. The room is lit by tungsten, not screens.

### Sound Design
| Moment | Sound |
|--------|-------|
| Enter room | Wooden door close, deep thud, silence |
| Pin card to wall | Soft cork push + pin click |
| Move table item | Paper slide/rustle |
| Open voice memo | Cassette mechanism sound |
| Complete TODO item | Match strike + extinguish |
| Ambient room | Quiet air, wood creak, distant tungsten buzz |

**Rule:** No notification sounds. No badges. No chimes. The room is quiet. The chaos is on the table, not in the air.

### Motion & Animation
- All camera moves: slow, breath-like, 2–4 seconds minimum
- Card movements: float with slight inertia, not snap-to-grid
- Lighting changes: gradual, theatrical fades
- Transitions between walls: "walk" animation — camera moves through space, not cut
- Micro-movements: dust particles, gentle card drift, light flicker

---

## CINEMATIC ENHANCEMENTS (2 Years Ahead)

### 1. Volumetric Memory
- Cards have depth. Tilt phone/parallax mouse moves — cards shift in 3D space
- The room exists in a light field. You can "look around" a card.
- Z-depth corresponds to importance/age — recent items float forward.

### 2. Atmospheric Intelligence
- Time of day affects the room: morning = warm side light, night = single pool of lamp light
- Weather outside the (invisible) window affects mood — rain adds distant sound, overcast dims the tungsten
- The room ages with you — wood darkens, cork shows pinholes, walls fill over months

### 3. Haptic Spatiality
- Haptic feedback tied to material: cork (soft), wood (dense), paper (light)
- "Walking" to a distant wall gives a gentle sustained haptic, like footsteps
- Pinning something gives a satisfying pop

### 4. Attention Residue
- The last card you touched keeps a faint glow for hours — your mental "finger" still on it
- Unfinished table items develop a subtle visual "pulse" — they nag, but visually, not with badges
- Completed TODO items leave a ghost impression for a day, then fade — accomplishment residue

### 5. The Door as Commitment
- To "leave" the room, you physically walk to the door (gesture/scroll)
- TODO_TONIGHT is checked. If empty or stale, a warm amber barrier prevents exit — gently.
- You can't leave without knowing what you're doing next. The door enforces intention.

---

## WHAT WE'RE BUILDING

This is **not** a todo app. This is **not** a notes app. This is **not** a project management tool.

This is a **spatial memory interface** — a room-shaped prosthetic for human attention. It uses architecture (not algorithms) to organize information. It uses ritual (not automation) to process inputs. It uses limitation (not infinite scroll) to protect focus.

The dump-cleaning step means: **the interface forces you to touch every piece of information before it earns a place on your walls.** There is no sync. There is no auto-import. There is only the table, your hands, and the walls.

This is software as sanctuary. An anti-feed. A room with a door that closes.

---

## TECHNICAL NOTES FOR LANDING PAGE

The landing page itself should embody the room metaphor:

1. **Hero section:** The cinematic entry sequence (video/GIF of frames 1–4)
2. **First scroll:** POV standing in the doorway. TODO_TONIGHT visible. Table visible.
3. **Second scroll:** Camera walks to a wall — "This is where your work lives"
4. **Third scroll:** Camera walks to table — "This is where noise dies"
5. **Fourth scroll:** Camera walks to door — "Leave with intention. Return with memory."

No feature grids. No pricing tables above the fold. No testimonial carousels.

Just a room. And an invitation to enter.
