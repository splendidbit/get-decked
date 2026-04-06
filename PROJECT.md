# Get Decked: Meltdown — Complete Project Documentation

> This document contains everything needed to understand, maintain, or rebuild this project from scratch.

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Architecture Overview](#architecture-overview)
3. [Game Rules (Complete)](#game-rules-complete)
4. [Deck Composition (All 80 Cards)](#deck-composition-all-80-cards)
5. [Data Model](#data-model)
6. [Backend: Firebase Cloud Functions](#backend-firebase-cloud-functions)
7. [iOS Client: SwiftUI App](#ios-client-swiftui-app)
8. [Multiplayer Flow](#multiplayer-flow)
9. [Push Notifications + Async Mode](#push-notifications--async-mode)
10. [iMessage Sticker Pack](#imessage-sticker-pack)
11. [Sound System](#sound-system)
12. [Character System](#character-system)
13. [Security Model](#security-model)
14. [File Structure (Complete)](#file-structure-complete)
15. [File-by-File Reference](#file-by-file-reference)
16. [Setup From Scratch](#setup-from-scratch)
17. [Deployment](#deployment)
18. [Testing](#testing)
19. [Balance Tuning](#balance-tuning)
20. [Known Limitations](#known-limitations)
21. [Future Roadmap](#future-roadmap)

---

## What This Is

Get Decked: Meltdown is a multiplayer mobile card game for iOS where 2–4 players push each other's stress meters to 10 using absurd cards. When someone hits 10, they **Melt Down** and are eliminated — but they get one last **Meltdown Tantrum** at double damage as revenge. Last player calm wins the round. Win best of 3 rounds (or 5 for 2-player) to win the game.

**Tone**: Absurdist/chaotic. Cards have names like "Existential Pudding," "Surprise Ghost Audit," and "Cloud That Believes in You."

**Modes**: Real-time synchronous (15-second turns) and asynchronous (24-hour turns with push notifications).

**Monetization model** (not yet implemented): Cosmetics only, zero pay-to-win. Characters, card backs, meltdown effects, season pass.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  iOS Client                       │
│  SwiftUI Views ← ViewModels ← Services           │
│           │              │           │            │
│     User Input     State Mgmt    Firebase SDK     │
└──────────┬───────────────┬───────────┬────────────┘
           │               │           │
           ▼               ▼           ▼
┌──────────────────────────────────────────────────┐
│              Firebase Infrastructure              │
│                                                   │
│  Cloud Functions (TypeScript)                     │
│    ├── Game Engine (all card logic)               │
│    ├── Callable Functions (6 endpoints)           │
│    └── Scheduled Functions (2 cron jobs)          │
│                                                   │
│  Cloud Firestore                                  │
│    ├── /games/{id}          (public game state)   │
│    ├── /games/{id}/hands/{playerId}  (private)    │
│    ├── /games/{id}/server/state      (server-only)│
│    └── /users/{id}          (profiles + FCM)      │
│                                                   │
│  Firebase Auth (Apple Sign-In + Anonymous)         │
│  Firebase Cloud Messaging (push notifications)     │
└──────────────────────────────────────────────────┘
```

### Key Design Decisions

**Server-authoritative**: ALL game logic runs in Cloud Functions. The iOS client is a thin renderer — it sends player actions and displays state from Firestore listeners. This prevents cheating and ensures a single source of truth.

**No client-side game engine**: The client has data models (Card, GameState) but no game logic. This eliminates the risk of client/server rule divergence. Latency is acceptable for a turn-based game.

**Firestore subcollections for privacy**: Each player's hand is in a separate subcollection with security rules that only allow that player to read it. The draw pile and discard pile are in a server-only subcollection that no client can access.

**Sync and async share identical logic**: Both modes use the same Cloud Functions, same data model, same Firestore structure. They differ only in turn timer duration (15s vs 24h) and notification delivery.

---

## Game Rules (Complete)

### Setup
- Shuffle the 80-card deck
- Deal 5 cards to each player
- All players start at **stress 3**
- Stress is always clamped to **0–10**
- Random player goes first

### Turn Structure
1. **Draw** 1 card from the draw pile
2. **Play** 1 card from your hand:
   - **Stress card** on any opponent → adds stress to their meter
   - **Chill card** on yourself → reduces your stress (floor 0)
   - **Special card** → various effects (see card types below)
3. Resolve triggered effects (Shields absorb, Deflects redirect)
4. Check for Meltdowns
5. Turn advances to next non-eliminated player

### Meltdown
When a player reaches **stress 10 or higher**:
- They are **eliminated** from the round
- They play a **Meltdown Tantrum**: choose 1 card from hand
  - **Stress card**: deal **double** its value to any remaining player
  - **Any other card**: deal **3 stress** to any remaining player
- If the Tantrum pushes another player to 10+, **chain meltdown** — that player also gets a Tantrum

### Winning
- Last player standing wins the round
- **Best of 3** rounds for 3–4 players
- **Best of 5** rounds for 2 players
- Between rounds: full reshuffle, redeal, stress resets to 3

### Pressure Phase
When the draw pile runs out:
- Shuffle discard pile into new draw pile
- From now on: **all players gain +1 stress** at the start of each full turn cycle
- This guarantees the game converges

### Card Types (10 total)

| Card | Count | Effect |
|------|-------|--------|
| **Stress +1/+2/+3/+4** | 34 total | Add stress to target opponent |
| **Chill -1/-2/-3** | 18 total | Reduce your own stress (floor 0) |
| **Zen** | 2 | Reset your stress to 0 |
| **Dump** | 6 | Transfer 2 stress: you -2, target +2 |
| **Shield** | 4 | Block next stress card targeting you (expires after your next turn) |
| **Deflect** | 4 | Redirect next stress card targeting you to chosen player (expires after your next turn) |
| **Snap** | 4 | Play this AND another card (double-action turn; follow-up can't be another Snap) |
| **Chain Reaction** | 4 | +2 stress to target; if they melt down, splash +2 to a second target |
| **Swap** | 2 | Trade stress levels with any opponent |
| **Peek** | 2 | Look at opponent's hand, draw 1 extra card |

### Shield & Deflect Resolution
All decisions happen on YOUR turn (critical for async). Shield and Deflect are played proactively and resolve automatically:
1. When stress is applied to a target, check for **Shield** first → if found, nullify the stress and remove the shield
2. If no Shield, check for **Deflect** → if found, redirect the stress to the deflect's chosen target (recursively — the redirect target can also have Shield/Deflect)
3. If neither, apply stress normally

---

## Deck Composition (All 80 Cards)

### Stress +1 (14 cards)
Judgmental Pigeon, Slightly Haunted Sock, Aggressive Breeze, Passive-Aggressive Note, Suspicious Yogurt, Unreliable Wi-Fi, Wet Doorknob, Overly Honest Mirror, Mildly Cursed Sandal, Unsolicited Wink, Sentient Speed Bump, Disappointed Cloud, Backhanded Compliment, Awkward Eye Contact

### Stress +2 (10 cards)
Existential Pudding, Sentient Traffic Jam, Unsolicited Advice Tornado, Rude Clouds, Anxious Furniture, Emotional Baggage Claim, Paranoid Toaster, Passive-Aggressive Weather, Condescending GPS, Haunted Spreadsheet

### Stress +3 (6 cards)
Surprise Ghost Audit, Angry Volcano Invitation, Tax Return That Bites, Spontaneous Gravity Reversal, Existential Crisis Delivery, Enraged Souffle

### Stress +4 (4 cards)
Full Moon of Bureaucracy, The Pudding Strikes Back, Catastrophic Brunch, Maximum Overdrive Monday

### Chill -1 (8 cards)
Complimentary Nap, Friendly Void, Lukewarm Approval, Ambient Birdsong, Acceptable Parking Spot, Pleasant Surprise, Adequate Burrito, Mild Validation

### Chill -2 (6 cards)
Spa Day (No Bees), Suspiciously Calm River, Therapeutic Sunset, Unearned Confidence, Cozy Thunderstorm, Perfectly Ripe Avocado

### Chill -3 (4 cards)
Perfect Burrito, Cloud That Believes in You, Infinite Blanket, Enlightened Noodle

### Special Cards (28 total)
- **Zen** (2): Ascended Potato, Nirvana Achieved (Temporarily)
- **Dump** (6): Not My Problem, Strategic Blame Redistribution, Emotional Hot Potato, Plausible Deniability, Masterful Deflection, Someone Else's Crisis
- **Shield** (4): Emotional Armor, Blanket Fort of Denial, Vibes-Only Force Field, Blissful Ignorance
- **Deflect** (4): Look Behind You!, It Was Like That When I Got Here, Classic Misdirection, The Old Switcheroo
- **Snap** (4): Caffeine Surge, Sudden Clarity Tornado, Adrenaline Dumpling, Double Espresso of Doom
- **Chain Reaction** (4): Domino Theory, Cascading Oops, Butterfly Effect Burrito, One Thing Led to Another
- **Swap** (2): Identity Crisis, Freaky Friday Juice
- **Peek** (2): Suspicious Telescope, Gossip from the Void

---

## Data Model

### Firestore: `games/{gameId}` (public — readable by players)

```typescript
{
  id: string,
  players: string[],                    // player UIDs in turn order
  playerNames: Record<string, string>,  // UID → display name
  stressLevels: Record<string, number>, // UID → stress (0-10)
  currentTurnIndex: number,             // index into players array
  round: number,                        // current round (1-based)
  roundWins: Record<string, number>,    // UID → wins count
  roundsToWin: number,                  // 3 for 3-4 players, 5 for 2 players
  status: 'waiting' | 'active' | 'meltdownPending' | 'roundEnd' | 'gameEnd',
  mode: 'sync' | 'async',
  eliminatedPlayers: string[],          // UIDs of eliminated players this round
  activeEffects: Record<string, ActiveEffect[]>, // UID → active shields/deflects
  turnLog: TurnLogEntry[],              // recent turn descriptions
  hostId: string,                       // game creator's UID
  roomCode: string,                     // 4-letter code (e.g., "ABCD")
  isPressurePhase: boolean,             // true after draw pile exhausted
  turnDeadline: number | null,          // timestamp (ms) for turn timeout
  meltdownPlayerId: string | null,      // UID of player who needs to play tantrum
  createdAt: number,                    // timestamp
  updatedAt: number,                    // timestamp
}
```

### Firestore: `games/{gameId}/hands/{playerId}` (private — only that player can read)

```typescript
{
  cards: Card[]  // array of Card objects in the player's hand
}
```

### Firestore: `games/{gameId}/server/state` (server-only — no client access)

```typescript
{
  drawPile: Card[],                     // face-down draw pile
  discardPile: Card[],                  // played cards
  hands: Record<string, Card[]>,        // all hands (redundant with subcollection, used by Cloud Functions for atomic transactions)
}
```

### Firestore: `users/{userId}`

```typescript
{
  displayName: string,
  avatarId: string,         // character ID (e.g., "jello_knight")
  cardBackId: string,       // cosmetic card back
  meltdownEffectId: string, // cosmetic meltdown effect
  stats: {
    gamesPlayed: number,
    wins: number,
    meltdownsCaused: number,
    tantrums: number,
  },
  coins: number,            // cosmetic currency (not yet implemented)
  ownedCosmetics: string[], // purchased cosmetic IDs
  fcmToken: string | null,  // Firebase Cloud Messaging token for push
}
```

### Card Object

```typescript
{
  id: string,          // unique ID (e.g., "card_42")
  type: CardType,      // enum: stress, chill, zen, dump, shield, deflect, snap, chainReaction, swap, peek
  name: string,        // display name (e.g., "Existential Pudding")
  description: string, // effect description (e.g., "+2 stress to target")
  value: number,       // stress/chill amount; 0 for most specials, 2 for dump & chainReaction
}
```

---

## Backend: Firebase Cloud Functions

### Game Engine Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript types and interfaces |
| `src/cards.ts` | 80-card catalog with names, `buildDeck()`, `shuffleDeck()` |
| `src/lifecycle.ts` | `createGame()`, `joinGame()`, `startGame()`, `resetRound()`, `generateRoomCode()` |
| `src/engine.ts` | `drawCard()`, `playCard()` (all 10 card types), `applyStress()` (shield/deflect chain), `advanceTurn()`, `applyPressure()` |
| `src/meltdown.ts` | `playTantrum()`, `checkRoundEnd()`, chain meltdown resolution |
| `src/notifications.ts` | Push notification message composition (no Firebase SDK calls) |
| `src/index.ts` | Cloud Function endpoints, Firestore orchestration, scheduled jobs |

### Cloud Function Endpoints

| Function | Type | Input | Output |
|----------|------|-------|--------|
| `createGameFn` | Callable | `{ mode, displayName }` | `{ gameId, roomCode }` |
| `joinGameFn` | Callable | `{ roomCode, displayName }` | `{ gameId }` |
| `startGameFn` | Callable | `{ gameId }` | `{ success }` |
| `playCardFn` | Callable | `PlayCardRequest` | `{ events }` |
| `playTantrumFn` | Callable | `TantrumRequest` | `{ events }` |
| `startNextRoundFn` | Callable | `{ gameId }` | `{ success }` |
| `rematchFn` | Callable | `{ gameId }` | `{ gameId }` (new game) |
| `checkTurnTimeouts` | Scheduled (1 min) | — | Auto-plays expired turns |
| `sendAsyncReminders` | Scheduled (1 hr) | — | Push reminders for stale games |

### Game Logic Flow

```
playCardFn called:
  1. Auth check
  2. Firestore transaction:
     a. Read game state + server state
     b. If pressure phase + first player in cycle → applyPressure()
        → If meltdown from pressure → write state, return
     c. drawCard() → adds 1 card to hand
     d. playCard() → validates, executes card effect, checks shield/deflect
        → If meltdown → status=MeltdownPending, return (no turn advance)
        → If no meltdown → advanceTurn(), set turnDeadline
     e. Write game state, server state, all hands
  3. Track stats (meltdownsCaused if applicable)
  4. Send push notification to next player (async only)
```

```
playTantrumFn called:
  1. Auth check (must be meltdownPlayerId)
  2. Firestore transaction:
     a. Read state
     b. playTantrum() → stress card = value×2, other = flat 3
        → If chain meltdown → status stays MeltdownPending for new player
        → If no chain → checkRoundEnd()
           → Round over → status=RoundEnd, update roundWins
           → Game over → status=GameEnd
           → Neither → status=Active, advance turn
     c. Write state
  3. Track stats (tantrums, wins, gamesPlayed)
  4. Send push notification
```

---

## iOS Client: SwiftUI App

### App Structure

```
GetDeckedApp (@main)
  └── HomeView (root)
        ├── Sign-In View (Apple Sign-In + Guest)
        ├── Name Prompt View
        └── Main Menu
              ├── Create Game Sheet → LobbyView
              ├── Join Game Sheet → LobbyView
              ├── Tutorial View
              └── Stats View

LobbyView
  └── (auto-navigates when game starts)
        └── GameBoardView
              ├── Opponents Bar (PlayerStatusView × N)
              ├── Turn Log
              ├── Status Bar (stress meter, round, timer)
              ├── Hand View (CardView × N)
              ├── Action Bar (Play/Cancel + card-specific controls)
              └── Overlays:
                    ├── MeltdownOverlay (tantrum selection)
                    ├── PeekOverlay (hand reveal)
                    └── GameEndView (scoreboard + rematch)
```

### Services

| Service | Singleton | Purpose |
|---------|-----------|---------|
| `AuthService` | `AuthService.shared` | Firebase Auth, user profiles, FCM token |
| `GameService` | `GameService.shared` | Cloud Function calls, Firestore listeners |
| `ConfigService` | `ConfigService.shared` | Balance tuning values (Remote Config stub) |
| `NotificationService` | Static methods | Push permission + notification routing |
| `FeedbackManager` | `FeedbackManager.shared` | Haptic + sound feedback for game events |
| `SoundEngine` | `SoundEngine.shared` | AVAudioEngine synth for all game sounds |

### ViewModels

| ViewModel | Manages |
|-----------|---------|
| `HomeViewModel` | Create/join game flow, room code input |
| `LobbyViewModel` | Real-time lobby state, auto-navigate on start |
| `GameViewModel` | All game state: hand, selections, targets, meltdown, peek, errors |

### Key UI Components

| View | Description |
|------|-------------|
| `CardView` | Renders a single card with type-based color, value/icon, selection highlight. Supports normal and compact sizes. |
| `HandView` | Horizontal scrolling fan of cards with overlap, rotation, and spring-animated selection. |
| `StressMeterView` | Animated bar (0–10) with color transitions (green→yellow→orange→red) and numeric text transition. |
| `PlayerStatusView` | Opponent badge: character avatar, name, stress meter, shield/deflect badges. |
| `TurnTimerView` | Countdown display for sync mode. Pulses red at ≤3 seconds. |
| `MeltdownOverlay` | Full-screen overlay with shake animation, card picker, target selector, damage preview. |
| `PeekOverlay` | Modal showing peeked player's hand (placeholder for MVP). |
| `GameEndView` | Round/game end scoreboard with rematch and share buttons. |

---

## Multiplayer Flow

### Creating and Joining a Game

```
Host                          Server                        Joiner
  │                              │                              │
  ├── createGameFn() ──────────►│                              │
  │◄── { gameId, roomCode } ────│                              │
  │                              │                              │
  │  [shares room code]          │                              │
  │                              │     ◄── joinGameFn(roomCode)─┤
  │                              │     ──── { gameId } ────────►│
  │                              │                              │
  │  [both listening to game doc]│                              │
  │                              │                              │
  ├── startGameFn() ───────────►│                              │
  │                              │── [deals cards, sets stress] │
  │◄── [state update via listener]◄──────── [state update] ───►│
```

### Playing a Turn (Async)

```
Player A                      Server                       Player B
  │                              │                              │
  ├── playCardFn() ────────────►│                              │
  │                              ├── [validate, execute]        │
  │                              ├── [advance turn to B]        │
  │◄── [state update] ──────────┤                              │
  │                              ├── [send push to B] ────────►│
  │                              │                    [notification]
  │                              │                              │
  │                              │     ◄── playCardFn() ────────┤
  │                              ├── [validate, execute]        │
  │◄── [state update] ──────────┤── [advance turn to A] ──────►│
```

### Meltdown Resolution

```
Player A plays +3 on Player B (who's at 8 stress):
  │
  ├── B stress: 8 → 11 (≥10)
  ├── B added to eliminatedPlayers
  ├── status = MeltdownPending
  ├── meltdownPlayerId = B
  │
  ├── [B selects tantrum card + target]
  │
  ├── playTantrumFn(card, target=A):
  │     ├── If stress card (value 3): damage = 3×2 = 6
  │     ├── If other card: damage = 3
  │     ├── Apply to target A
  │     │
  │     ├── If A reaches 10+ → CHAIN MELTDOWN
  │     │     ├── A gets their own tantrum
  │     │     └── Repeat until no more chains
  │     │
  │     └── If no chain → checkRoundEnd()
  │           ├── 1 player left → RoundEnd
  │           └── 2+ left → Active, advance turn
```

---

## Push Notifications + Async Mode

### Notification Types

| Trigger | Title | Body Example |
|---------|-------|-------------|
| Your turn | "Get Decked" | "Existential Pudding hit you! Stress: 7/10. Your turn!" |
| Your tantrum | "You MELTED DOWN!" | "Choose a card for your tantrum — make them pay!" |
| Meltdown happened | "MELTDOWN!" | "Alex melted down! Your turn, Bob." |
| Re-engagement (4h) | "Your friends are waiting!" | "Alex is at 9/10 stress! Tap to play." |

### Turn Timeout Auto-Play

A scheduled function runs every minute and checks for expired `turnDeadline`:

- **Active turn timeout**: Auto-plays the lowest stress card on a random opponent (or chill/shield if no stress cards)
- **Meltdown tantrum timeout**: Auto-plays the highest stress card (for max tantrum damage) on a random target
- Both use the same game engine functions as manual play

### Deep Links

URL scheme: `getdecked://join/{roomCode}`

When opened, routes through `DeepLinkHandler` → `HomeViewModel.activeGameId` → navigates to lobby/game.

---

## iMessage Sticker Pack

12 SVG stickers in `ios/GetDeckedStickers/Stickers.xcstickers/Sticker Pack.stickerpack/`:

MELTDOWN!, ZEN, YOU'RE TOAST, NOT MY PROBLEM, TANTRUM!, CHILL, +4 STRESS, SWAP, SHIELD UP, GG, STRESSED, REMATCH?

Each sticker is a 300×300 SVG with bold text, emoji accent, and colored background. The sticker pack is a separate app extension target (`GetDeckedStickers`).

---

## Sound System

All sounds are synthesized programmatically via `AVAudioEngine` — no audio files needed.

`SoundEngine.swift` generates PCM buffers from sine waves and noise:

| Sound | Method | Implementation |
|-------|--------|----------------|
| Card play | `cardPlay()` | 880Hz, 50ms click |
| Stress hit | `stressHit()` | 120Hz, 150ms thud |
| Chill | `chillSound()` | 1200→1500Hz ascending chime |
| Zen | `zenSound()` | C-E-G-C ascending chord (523→1047Hz) |
| Meltdown | `meltdownSound()` | Descending alarm (800→350Hz) + noise burst |
| Tantrum | `tantrumSound()` | 200Hz impact + noise |
| Turn ping | `turnPing()` | 1000Hz, 80ms |
| Victory | `victorySound()` | C-E-G-C fanfare |
| Heartbeat | `heartbeat()` | 60Hz + 55Hz double pulse |
| Swap | `swapSound()` | Ascending sweep 300→1100Hz |
| Shield | `shieldSound()` | 440→660Hz two-tone |

`FeedbackManager.swift` pairs each sound with a UIKit haptic (impact/notification generators).

---

## Character System

3 characters defined in `Character.swift`:

| ID | Name | SF Symbol | Color |
|----|------|-----------|-------|
| `jello_knight` | Jello Knight | `shield.lefthalf.filled` | Green |
| `tax_return` | Sentient Tax Return | `doc.text.fill` | Red |
| `existential_avocado` | Existential Avocado | `leaf.fill` | Green |

Characters are displayed in `PlayerStatusView` as colored circles with SF Symbol icons. The `avatarId` field on `UserProfile` maps to a character.

---

## Security Model

### Firestore Rules

```
/users/{userId}           → Read: any authed user. Write: only own user.
/games/{gameId}           → Read: only players in game. Write: Cloud Functions only.
/games/{id}/hands/{pid}   → Read: only that player. Write: Cloud Functions only.
/games/{id}/server/*      → Read/Write: nobody (admin SDK only).
```

### Authentication

- **Apple Sign-In**: Primary auth method. Uses `OAuthProvider.appleCredential`.
- **Anonymous auth**: "Play as Guest" for zero-friction onboarding. Can later link to Apple account.

### Cheating Prevention

- All game logic is server-side (Cloud Functions)
- Draw pile and discard pile are in a server-only subcollection — clients can't see upcoming cards
- Each player's hand is in a per-player subcollection — can't see opponents' cards
- Card plays are validated server-side (correct turn, card in hand, valid target)
- Shield/Deflect resolve server-side, not client-side

---

## File Structure (Complete)

```
get-decked/
├── .gitignore
├── PROJECT.md                            ← this file
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-04-06-get-decked-meltdown-design.md
│       └── plans/
│           └── 2026-04-06-get-decked-meltdown.md
├── firebase/
│   ├── .firebaserc                       # Firebase project ID
│   ├── firebase.json                     # Firebase config
│   ├── firestore.rules                   # Security rules
│   ├── firestore.indexes.json            # Composite indexes
│   └── functions/
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.js
│       ├── src/
│       │   ├── types.ts                  # All shared types
│       │   ├── cards.ts                  # 80-card deck catalog
│       │   ├── engine.ts                 # Core game engine
│       │   ├── lifecycle.ts              # Game create/join/start
│       │   ├── meltdown.ts              # Tantrum + chain resolution
│       │   ├── notifications.ts          # Push message composition
│       │   └── index.ts                  # Cloud Function endpoints
│       └── test/
│           ├── cards.test.ts
│           ├── engine.test.ts
│           ├── lifecycle.test.ts
│           └── meltdown.test.ts
└── ios/
    ├── project.yml                       # XcodeGen definition
    ├── GetDecked.xcodeproj/              # Generated (don't edit manually)
    ├── GetDecked/
    │   ├── Info.plist
    │   ├── GetDecked.entitlements
    │   ├── App/
    │   │   ├── GetDeckedApp.swift        # @main entry + deep links
    │   │   └── AppDelegate.swift         # Firebase init + push handling
    │   ├── Models/
    │   │   ├── Card.swift                # Card + CardType
    │   │   ├── GameState.swift           # GameState + GameStatus + GameMode + effects + log
    │   │   ├── Player.swift              # UserProfile + PlayerStats
    │   │   └── Character.swift           # 3 character definitions
    │   ├── Services/
    │   │   ├── AuthService.swift         # Firebase Auth + profiles
    │   │   ├── GameService.swift         # Cloud Function calls + listeners
    │   │   ├── ConfigService.swift       # Balance tuning values
    │   │   └── NotificationService.swift # Push permission + handling
    │   ├── ViewModels/
    │   │   ├── HomeViewModel.swift       # Create/join game state
    │   │   ├── LobbyViewModel.swift      # Lobby state + auto-navigate
    │   │   └── GameViewModel.swift       # All game UI state
    │   ├── Views/
    │   │   ├── HomeView.swift            # Root: sign-in, menu, sheets
    │   │   ├── LobbyView.swift           # Room code, player list, start
    │   │   ├── GameBoardView.swift       # Main game screen
    │   │   ├── HandView.swift            # Card fan with selection
    │   │   ├── CardView.swift            # Single card rendering
    │   │   ├── StressMeterView.swift     # Animated 0-10 bar
    │   │   ├── PlayerStatusView.swift    # Opponent status badge
    │   │   ├── TurnTimerView.swift       # Countdown for sync mode
    │   │   ├── MeltdownOverlay.swift     # Tantrum selection UI
    │   │   ├── PeekOverlay.swift         # Peek result display
    │   │   ├── GameEndView.swift         # Scoreboard + rematch
    │   │   ├── TutorialView.swift        # 6-step onboarding
    │   │   ├── StatsView.swift           # Player statistics
    │   │   └── LaunchScreenView.swift    # Splash screen
    │   ├── Helpers/
    │   │   ├── DeepLinkHandler.swift     # URL scheme routing
    │   │   ├── FeedbackManager.swift     # Haptic + sound triggers
    │   │   ├── SoundEngine.swift         # AVAudioEngine synthesizer
    │   │   └── ShareHelper.swift         # iMessage share sheets
    │   └── Resources/
    │       ├── AppIcon.svg
    │       └── Assets.xcassets/
    │           ├── Contents.json
    │           ├── AppIcon.appiconset/
    │           └── LaunchBackground.colorset/
    ├── GetDeckedTests/
    │   ├── CardTests.swift               # Card model tests
    │   └── GameStateTests.swift          # GameState computed property tests
    └── GetDeckedStickers/
        ├── Info.plist
        └── Stickers.xcstickers/
            ├── Contents.json
            └── Sticker Pack.stickerpack/
                ├── Contents.json
                └── [12 sticker folders]/
                    ├── Contents.json
                    └── sticker.svg
```

---

## File-by-File Reference

### Backend: `firebase/functions/src/`

**`types.ts`** — All shared types. Enums: `CardType` (10 values), `GameStatus` (5 values), `GameMode` (2 values). Interfaces: `Card`, `ActiveEffect`, `TurnLogEntry`, `GameState` (21 fields), `ServerState`, `PlayCardRequest` (with nested `snapFollowUp`), `TantrumRequest`, `GameEvent`.

**`cards.ts`** — Card catalog. `STRESS_TEMPLATES` (4 tiers), `CHILL_TEMPLATES` (3 tiers), `SPECIAL_TEMPLATES` (8 types). `buildDeck()` generates all 80 cards with sequential IDs. `shuffleDeck()` uses Fisher-Yates (immutable).

**`lifecycle.ts`** — Game lifecycle. `generateRoomCode()` produces 4-char codes (no I/O). `createGame()` initializes waiting state. `joinGame()` validates capacity/status/duplicates. `startGame()` shuffles, deals 5, sets stress to 3, picks random first player, sets turnDeadline. `resetRound()` same but increments round.

**`engine.ts`** — Core engine. `drawCard()` pops from draw pile; reshuffles discard on empty and enters pressure phase. `playCard()` handles all 10 card types via switch statement: validates turn/card/target, executes effect, checks meltdown. Internal `applyStress()` chains Shield→Deflect→raw damage. `advanceTurn()` skips eliminated, expires effects, sets turnDeadline. `applyPressure()` adds +1 to all active players.

**`meltdown.ts`** — Tantrum resolution. `playTantrum()` validates meltdown player, calculates damage (stress×2 or flat 3), applies to target, handles chain meltdown. `checkRoundEnd()` detects last-player-standing and game win.

**`notifications.ts`** — Message composition (pure functions, no SDK). `composeTurnNotification()`, `composeMeltdownNotification()`, `composeRoundEndNotification()`, `composeShareMessage()`.

**`index.ts`** — Firebase entry. 7 callable functions + 2 scheduled. All game writes use Firestore transactions. `playCardFn` handles pressure→draw→play→advance pipeline. `checkTurnTimeouts` runs every minute for auto-play. `sendAsyncReminders` runs every hour for re-engagement. `updatePlayerStats()` helper uses `FieldValue.increment`.

### iOS: `ios/GetDecked/`

**`App/GetDeckedApp.swift`** — @main struct. Configures AppDelegate adaptor, sets HomeView as root with AuthService environment object, handles `getdecked://join/` deep links.

**`App/AppDelegate.swift`** — Firebase.configure(), FCM delegate, push notification permission, APNs token relay, notification tap → DeepLinkHandler.

**`Models/Card.swift`** — `CardType` enum (10 cases), `Card` struct with computed booleans: `requiresTarget`, `requiresRedirectTarget`, `requiresSplashTarget`, `requiresFollowUp`.

**`Models/GameState.swift`** — `GameStatus`, `GameMode` enums, `ActiveEffect`, `TurnLogEntry` (Identifiable), `GameState` with computed `currentPlayerId`, `activePlayers`, helper methods `isEliminated()`, `stressFor()`, `nameFor()`.

**`Models/Player.swift`** — `UserProfile` (Codable), `PlayerStats` with `static empty`.

**`Models/Character.swift`** — `GameCharacter` with SF Symbol icons. 3 built-in characters. `forId()` lookup.

**`Services/AuthService.swift`** — Singleton. Apple Sign-In + anonymous. Profile CRUD. FCM token management. @MainActor.

**`Services/GameService.swift`** — Singleton. 7 Cloud Function wrappers. 2 Firestore listeners (`listenToGame`, `listenToHand`).

**`Services/ConfigService.swift`** — Singleton. All balance constants with stub `fetch()` for Remote Config integration.

**`Services/NotificationService.swift`** — Static. `requestPermission()` + `handleNotification()` → DeepLinkHandler.

**`ViewModels/GameViewModel.swift`** — @MainActor. 15+ @Published properties for game state, selections, overlays. Real-time listeners with haptic/sound feedback on state changes. `playSelectedCard()`, `playTantrum()`, `startNextRound()`, `dismissPeek()`, `clearSelection()`.

**`ViewModels/HomeViewModel.swift`** — @MainActor. Create/join game flow with loading/error state.

**`ViewModels/LobbyViewModel.swift`** — @MainActor. Real-time lobby listener. Auto-navigates on game start.

**`Views/GameBoardView.swift`** — Main game screen. Opponent bar with tap-to-target (supports Snap follow-up targeting and Chain Reaction splash targeting). Turn log. Status bar with stress + timer. Hand view. Context-sensitive action bar: `snapActionBar`, `chainReactionActionBar`, `deflectActionBar`, standard play. Overlays: meltdown, peek, game end.

**`Views/CardView.swift`** — Card rendering. Color by type (red/blue/cyan/orange/gray/purple/yellow/pink/green/indigo). SF Symbol icons for specials. Selection highlight (yellow border + shadow). Normal and compact sizes.

**`Views/HandView.swift`** — Horizontal scroll with -20pt overlap. Rotation effect (fan). Selected card lifts. Spring animations. FeedbackManager on select.

**`Views/StressMeterView.swift`** — Bar fill with color transitions. `.contentTransition(.numericText())`. Spring animation on change.

**`Views/PlayerStatusView.swift`** — Character avatar circle. Current-turn highlight. Shield/deflect badges. Compact mode for 3+ opponents.

**`Views/TurnTimerView.swift`** — 1-second Timer publisher. Red at ≤5s. Scale pulse at ≤3s. Haptic at ≤3s. Sync mode only.

**`Views/MeltdownOverlay.swift`** — Full-screen. Shake + pulse animation on title. Progressive content reveal. Card picker + target selector + damage preview. Haptic + sound on appear.

**`Views/PeekOverlay.swift`** — Modal with card display (placeholder for MVP). Tap-to-dismiss.

**`Views/GameEndView.swift`** — Round/game distinction. Winner + scoreboard. Next Round / Rematch / Share buttons. Appear animation + victory haptic.

**`Views/TutorialView.swift`** — 6-step paginated walkthrough. Dot indicator. Back/Next/Let's Play.

**`Views/StatsView.swift`** — List with StatRow. Win rate calculation.

**`Views/LaunchScreenView.swift`** — Red gradient + "GET DECKED" title.

**`Helpers/DeepLinkHandler.swift`** — Singleton. `pendingGameId` publisher. `handleGameDeepLink()` + `consumePendingGame()`.

**`Helpers/FeedbackManager.swift`** — Singleton. UIKit haptic generators (light/medium/heavy/notification) + SoundEngine calls. Methods: `cardPlayed`, `stressReceived`, `chillPlayed`, `meltdown`, `tantrum`, `zenPlayed`, `roundWon`, `turnStart`.

**`Helpers/SoundEngine.swift`** — AVAudioEngine + AVAudioPlayerNode. `playTone(frequency, duration, volume, fadeOut)` generates sine waves. `playNoise()` generates white noise. 11 game sound methods.

**`Helpers/ShareHelper.swift`** — Static. `shareGameInvite()` via UIActivityViewController. `shareGameResult()` formats standings.

---

## Setup From Scratch

### Prerequisites
- macOS with Xcode 16+
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- XcodeGen: `brew install xcodegen`
- Apple Developer account (for push notifications and TestFlight)

### Step 1: Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create new project named "get-decked"
3. Enable **Authentication** → Sign-in providers:
   - Apple (requires Apple Developer account configuration)
   - Anonymous
4. Create **Firestore Database** (start in production mode)
5. Go to Project Settings → General → Your Apps → Add iOS App:
   - Bundle ID: `com.splendidbit.getdecked`
   - Download `GoogleService-Info.plist`
6. Place `GoogleService-Info.plist` in `ios/GetDecked/`
7. Update `firebase/.firebaserc` with your project ID if different from "get-decked"

### Step 2: Deploy Backend

```bash
cd firebase/functions
npm install
npm test              # verify 61 tests pass
npm run build         # verify clean compile
cd ..
firebase login
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Step 3: Configure Push Notifications

1. In Apple Developer portal: create an APNs Key (Keys → + → Apple Push Notifications service)
2. Download the .p8 key file
3. In Firebase Console → Project Settings → Cloud Messaging → Apple app configuration:
   - Upload the .p8 key
   - Enter Key ID and Team ID

### Step 4: Build iOS App

```bash
cd ios
xcodegen generate     # creates GetDecked.xcodeproj
open GetDecked.xcodeproj
```

In Xcode:
1. Wait for SPM package resolution (Firebase SDK, ~2-3 minutes first time)
2. Select your development team in Signing & Capabilities
3. Build and run on Simulator or device

### Step 5: Test

1. Run on two Simulators (or Simulator + device)
2. Sign in as guest on both
3. Create game on one, join with room code on the other
4. Play a full game

---

## Deployment

### Deploy Cloud Functions
```bash
cd firebase
firebase deploy --only functions
```

### Deploy Firestore Rules
```bash
cd firebase
firebase deploy --only firestore:rules
```

### Deploy Everything
```bash
cd firebase
firebase deploy
```

### iOS TestFlight
1. In Xcode: Product → Archive
2. Distribute App → TestFlight
3. Wait for Apple processing (~15 min)
4. Add testers in App Store Connect

---

## Testing

### Backend Tests
```bash
cd firebase/functions
npm test                    # run all 61 tests
npm test -- --watch         # watch mode
npx jest test/engine.test.ts  # run specific suite
```

**Test suites:**
- `cards.test.ts` — Deck composition (14 tests)
- `engine.test.ts` — All card types + turn mechanics (27 tests)
- `lifecycle.test.ts` — Game create/join/start (11 tests)
- `meltdown.test.ts` — Tantrum + round end (9 tests)

### iOS Tests
```bash
cd ios
xcodebuild test -scheme GetDecked -destination 'platform=iOS Simulator,name=iPhone 16'
```

**Test files:**
- `CardTests.swift` — Card computed properties (4 tests)
- `GameStateTests.swift` — State helper methods (1 test)

### Local Development with Emulators
```bash
cd firebase
firebase emulators:start --only functions,firestore
```
This runs Cloud Functions and Firestore locally. Point the iOS app to the emulator by adding to AppDelegate:
```swift
Functions.functions().useEmulator(withHost: "localhost", port: 5001)
let settings = Firestore.firestore().settings
settings.host = "localhost:8080"
settings.isSSLEnabled = false
Firestore.firestore().settings = settings
```

---

## Balance Tuning

All card values can be tuned without app updates via Firebase Remote Config (stub in `ConfigService.swift`):

| Parameter | Default | Effect |
|-----------|---------|--------|
| `startingStress` | 3 | Higher = shorter rounds |
| `roundsToWin3Plus` | 3 | More rounds = longer games |
| `roundsToWin2Player` | 5 | Averaging out 2-player swinginess |
| `dumpTransferAmount` | 2 | Dump card power |
| `chainReactionDamage` | 2 | Chain Reaction primary hit |
| `chainReactionSplash` | 2 | Chain Reaction splash damage |
| `tantrumStressMultiplier` | 2 | Stress card tantrum multiplier |
| `tantrumFlatDamage` | 3 | Non-stress card tantrum damage |
| `pressureStressPerCycle` | 1 | Pressure phase acceleration |
| `syncTurnSeconds` | 15 | Real-time turn timer |
| `asyncTurnHours` | 24 | Async turn timeout |

**Note**: These values are currently hardcoded in `ConfigService.swift` and the backend. To make them dynamic:
1. Set up Firebase Remote Config in the Firebase Console
2. Add the `FirebaseRemoteConfig` SDK dependency
3. Implement the `fetch()` method in `ConfigService.swift`
4. Read config values in Cloud Functions via `admin.remoteConfig()`

---

## Known Limitations

1. **Peek doesn't show opponent's hand** — The peek card logs an event and draws an extra card, but the actual hand contents aren't returned to the client (Firestore security rules prevent reading other players' hands). Full peek display requires a backend change to return the hand in the Cloud Function response.

2. **ConfigService values aren't used by the backend** — The balance values in `ConfigService.swift` are client-only placeholders. The backend has its own hardcoded values in the game engine. Making them truly dynamic requires Remote Config integration on both sides.

3. **No offline support** — The app requires an internet connection. Firestore has built-in offline persistence for reads, but game actions (Cloud Function calls) fail offline.

4. **Sound requires device** — `AVAudioEngine` synth sounds may not play in Simulator depending on audio configuration. Test on a real device.

5. **SVG app icon** — Xcode 15+ supports SVG app icons directly, but some older toolchains may need PNG exports.

6. **Sticker text rendering** — SVG stickers use `system-ui` font which renders differently across systems. The stickers look correct on iOS but may render differently in other contexts.

---

## Future Roadmap

### v1.1
- 5-player support
- Full iMessage App Extension (play from iMessage)
- Premium character shop
- Season Pass ($4.99/mo)
- Season rankings (ELO tiers: Chill → Warm → Hot → Volcanic → Meltdown)
- Achievements
- Random matchmaking

### v1.2
- Friend streaks (shared cosmetics at milestones)
- Groups with stats
- Spectator mode
- Weekly challenge modifiers
- Clip sharing (auto-capture dramatic moments)

### v2.0
- Android client
- Cross-platform play
