# Get Decked: Meltdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of Get Decked: Meltdown — an absurdist multiplayer card game with stress meters, meltdown tantrums, real-time and async play, Firebase backend, and iOS client with iMessage sharing.

**Architecture:** Server-authoritative — all game logic runs in Firebase Cloud Functions (TypeScript). The iOS client (SwiftUI) is a thin renderer: it sends player actions to callable Cloud Functions and displays state received via Firestore real-time listeners. Firestore uses subcollections for per-player hand privacy and server-only draw/discard pile access. Both sync and async modes share identical game logic; they differ only in turn timer enforcement and notification delivery.

**Tech Stack:**
- **Backend:** Firebase Cloud Functions v2 (TypeScript), Cloud Firestore, Firebase Auth, Firebase Cloud Messaging
- **Client:** Swift 5.9, SwiftUI, SpriteKit (animations), Firebase iOS SDK 11+
- **Build:** XcodeGen (iOS project generation), npm (Cloud Functions), Firebase CLI
- **Testing:** Jest (Cloud Functions), XCTest (iOS models)

---

## File Structure

```
get-decked/
├── firebase/
│   ├── firebase.json
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── functions/
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.js
│       ├── src/
│       │   ├── types.ts              # All shared TypeScript types
│       │   ├── cards.ts              # Card catalog + deck builder
│       │   ├── engine.ts             # Core game engine (turn flow, stress, effects)
│       │   ├── meltdown.ts           # Meltdown + tantrum + chain resolution
│       │   ├── lifecycle.ts          # Game creation, join, start, round reset
│       │   ├── notifications.ts      # Push notification composition + send
│       │   └── index.ts              # Cloud Function endpoint definitions
│       └── test/
│           ├── cards.test.ts
│           ├── engine.test.ts
│           ├── meltdown.test.ts
│           └── lifecycle.test.ts
├── ios/
│   ├── project.yml                   # XcodeGen project definition
│   ├── GetDecked/
│   │   ├── App/
│   │   │   ├── GetDeckedApp.swift
│   │   │   └── AppDelegate.swift
│   │   ├── Models/
│   │   │   ├── Card.swift
│   │   │   ├── GameState.swift
│   │   │   └── Player.swift
│   │   ├── Services/
│   │   │   ├── AuthService.swift
│   │   │   ├── GameService.swift
│   │   │   └── NotificationService.swift
│   │   ├── ViewModels/
│   │   │   ├── HomeViewModel.swift
│   │   │   ├── LobbyViewModel.swift
│   │   │   └── GameViewModel.swift
│   │   ├── Views/
│   │   │   ├── HomeView.swift
│   │   │   ├── LobbyView.swift
│   │   │   ├── GameBoardView.swift
│   │   │   ├── HandView.swift
│   │   │   ├── CardView.swift
│   │   │   ├── StressMeterView.swift
│   │   │   ├── PlayerStatusView.swift
│   │   │   ├── MeltdownOverlay.swift
│   │   │   ├── GameEndView.swift
│   │   │   ├── TutorialView.swift
│   │   │   └── StatsView.swift
│   │   ├── Helpers/
│   │   │   ├── ShareHelper.swift
│   │   │   └── DeepLinkHandler.swift
│   │   ├── Resources/
│   │   │   └── Assets.xcassets/
│   │   └── Info.plist
│   ├── GetDeckedTests/
│   │   ├── CardTests.swift
│   │   └── GameStateTests.swift
│   └── GetDeckedStickers/
│       ├── Stickers.xcstickers/
│       └── Info.plist
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-04-06-get-decked-meltdown-design.md
        └── plans/
            └── 2026-04-06-get-decked-meltdown.md
```

---

## Phase 1: Game Engine (Firebase Cloud Functions)

### Task 1: Project Setup + TypeScript Types

**Files:**
- Create: `firebase/firebase.json`
- Create: `firebase/functions/package.json`
- Create: `firebase/functions/tsconfig.json`
- Create: `firebase/functions/jest.config.js`
- Create: `firebase/functions/src/types.ts`

- [ ] **Step 1: Initialize Firebase project config**

```json
// firebase/firebase.json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

```json
// firebase/firestore.indexes.json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Create Cloud Functions package.json**

```json
// firebase/functions/package.json
{
  "name": "get-decked-functions",
  "version": "1.0.0",
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "jest --forceExit --detectOpenHandles",
    "test:watch": "jest --watch",
    "serve": "npm run build && firebase emulators:start --only functions,firestore",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json and jest.config.js**

```json
// firebase/functions/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2022",
    "esModuleInterop": true,
    "declaration": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

```javascript
// firebase/functions/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
};
```

- [ ] **Step 4: Define all TypeScript types**

```typescript
// firebase/functions/src/types.ts

export enum CardType {
  Stress = 'stress',
  Chill = 'chill',
  Zen = 'zen',
  Dump = 'dump',
  Shield = 'shield',
  Deflect = 'deflect',
  Snap = 'snap',
  ChainReaction = 'chainReaction',
  Swap = 'swap',
  Peek = 'peek',
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  value: number; // stress/chill amount; 0 for most specials, 2 for dump & chainReaction
}

export interface ActiveEffect {
  type: 'shield' | 'deflect';
  redirectTargetId?: string;
  expiresAfterTurnOf: string;
}

export interface TurnLogEntry {
  playerId: string;
  cardName: string;
  cardType: CardType;
  targetId?: string;
  stressChange?: number;
  description: string;
}

export enum GameStatus {
  Waiting = 'waiting',
  Active = 'active',
  MeltdownPending = 'meltdownPending',
  RoundEnd = 'roundEnd',
  GameEnd = 'gameEnd',
}

export enum GameMode {
  Sync = 'sync',
  Async = 'async',
}

export interface GameState {
  id: string;
  players: string[];
  playerNames: Record<string, string>;
  stressLevels: Record<string, number>;
  currentTurnIndex: number;
  round: number;
  roundWins: Record<string, number>;
  roundsToWin: number;
  status: GameStatus;
  mode: GameMode;
  eliminatedPlayers: string[];
  activeEffects: Record<string, ActiveEffect[]>;
  turnLog: TurnLogEntry[];
  hostId: string;
  roomCode: string;
  isPressurePhase: boolean;
  turnDeadline: number | null;
  meltdownPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ServerState {
  drawPile: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
}

export interface PlayCardRequest {
  gameId: string;
  cardId: string;
  targetId?: string;
  deflectRedirectTargetId?: string;
  chainReactionSplashTargetId?: string;
  snapFollowUp?: {
    cardId: string;
    targetId?: string;
    deflectRedirectTargetId?: string;
    chainReactionSplashTargetId?: string;
  };
}

export interface TantrumRequest {
  gameId: string;
  cardId: string;
  targetId: string;
}

export interface GameEvent {
  type: string;
  playerId?: string;
  targetId?: string;
  cardName?: string;
  damage?: number;
  oldStress?: number;
  newStress?: number;
  description: string;
}
```

- [ ] **Step 5: Install dependencies and verify build**

Run: `cd firebase/functions && npm install && npm run build`
Expected: Clean compile, `lib/` directory created with `types.js` and `types.d.ts`.

- [ ] **Step 6: Commit**

```bash
git add firebase/
git commit -m "feat: initialize Firebase project and define TypeScript types"
```

---

### Task 2: Card Catalog + Deck Builder

**Files:**
- Create: `firebase/functions/src/cards.ts`
- Create: `firebase/functions/test/cards.test.ts`

- [ ] **Step 1: Write failing tests for deck builder**

```typescript
// firebase/functions/test/cards.test.ts
import { buildDeck, shuffleDeck } from '../src/cards';
import { CardType } from '../src/types';

describe('buildDeck', () => {
  const deck = buildDeck();

  test('contains exactly 80 cards', () => {
    expect(deck).toHaveLength(80);
  });

  test('all cards have unique ids', () => {
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(80);
  });

  test('contains 14 stress+1 cards', () => {
    const s1 = deck.filter(c => c.type === CardType.Stress && c.value === 1);
    expect(s1).toHaveLength(14);
  });

  test('contains 10 stress+2 cards', () => {
    const s2 = deck.filter(c => c.type === CardType.Stress && c.value === 2);
    expect(s2).toHaveLength(10);
  });

  test('contains 6 stress+3 cards', () => {
    const s3 = deck.filter(c => c.type === CardType.Stress && c.value === 3);
    expect(s3).toHaveLength(6);
  });

  test('contains 4 stress+4 cards', () => {
    const s4 = deck.filter(c => c.type === CardType.Stress && c.value === 4);
    expect(s4).toHaveLength(4);
  });

  test('contains 34 total stress cards', () => {
    const stress = deck.filter(c => c.type === CardType.Stress);
    expect(stress).toHaveLength(34);
  });

  test('contains 8 chill-1, 6 chill-2, 4 chill-3 cards', () => {
    const c1 = deck.filter(c => c.type === CardType.Chill && c.value === 1);
    const c2 = deck.filter(c => c.type === CardType.Chill && c.value === 2);
    const c3 = deck.filter(c => c.type === CardType.Chill && c.value === 3);
    expect(c1).toHaveLength(8);
    expect(c2).toHaveLength(6);
    expect(c3).toHaveLength(4);
  });

  test('contains 18 total chill cards', () => {
    const chill = deck.filter(c => c.type === CardType.Chill);
    expect(chill).toHaveLength(18);
  });

  test('contains correct special card counts', () => {
    expect(deck.filter(c => c.type === CardType.Zen)).toHaveLength(2);
    expect(deck.filter(c => c.type === CardType.Dump)).toHaveLength(6);
    expect(deck.filter(c => c.type === CardType.Shield)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Deflect)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Snap)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.ChainReaction)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Swap)).toHaveLength(2);
    expect(deck.filter(c => c.type === CardType.Peek)).toHaveLength(2);
  });

  test('all cards have non-empty name and description', () => {
    for (const card of deck) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
    }
  });
});

describe('shuffleDeck', () => {
  test('returns same number of cards', () => {
    const deck = buildDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(80);
  });

  test('does not mutate original', () => {
    const deck = buildDeck();
    const firstId = deck[0].id;
    shuffleDeck(deck);
    expect(deck[0].id).toBe(firstId);
  });

  test('changes card order (statistical — may rarely fail)', () => {
    const deck = buildDeck();
    const shuffled = shuffleDeck(deck);
    const samePosition = deck.filter((c, i) => c.id === shuffled[i].id).length;
    // Extremely unlikely that more than 10 cards stay in place after shuffle
    expect(samePosition).toBeLessThan(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd firebase/functions && npx jest test/cards.test.ts`
Expected: FAIL — `Cannot find module '../src/cards'`

- [ ] **Step 3: Implement card catalog and deck builder**

```typescript
// firebase/functions/src/cards.ts
import { Card, CardType } from './types';

interface CardTemplate {
  value: number;
  names: string[];
}

const STRESS_TEMPLATES: CardTemplate[] = [
  {
    value: 1,
    names: [
      'Judgmental Pigeon', 'Slightly Haunted Sock', 'Aggressive Breeze',
      'Passive-Aggressive Note', 'Suspicious Yogurt', 'Unreliable Wi-Fi',
      'Wet Doorknob', 'Overly Honest Mirror', 'Mildly Cursed Sandal',
      'Unsolicited Wink', 'Sentient Speed Bump', 'Disappointed Cloud',
      'Backhanded Compliment', 'Awkward Eye Contact',
    ],
  },
  {
    value: 2,
    names: [
      'Existential Pudding', 'Sentient Traffic Jam', 'Unsolicited Advice Tornado',
      'Rude Clouds', 'Anxious Furniture', 'Emotional Baggage Claim',
      'Paranoid Toaster', 'Passive-Aggressive Weather', 'Condescending GPS',
      'Haunted Spreadsheet',
    ],
  },
  {
    value: 3,
    names: [
      'Surprise Ghost Audit', 'Angry Volcano Invitation', 'Tax Return That Bites',
      'Spontaneous Gravity Reversal', 'Existential Crisis Delivery', 'Enraged Souffle',
    ],
  },
  {
    value: 4,
    names: [
      'Full Moon of Bureaucracy', 'The Pudding Strikes Back',
      'Catastrophic Brunch', 'Maximum Overdrive Monday',
    ],
  },
];

const CHILL_TEMPLATES: CardTemplate[] = [
  {
    value: 1,
    names: [
      'Complimentary Nap', 'Friendly Void', 'Lukewarm Approval',
      'Ambient Birdsong', 'Acceptable Parking Spot', 'Pleasant Surprise',
      'Adequate Burrito', 'Mild Validation',
    ],
  },
  {
    value: 2,
    names: [
      'Spa Day (No Bees)', 'Suspiciously Calm River', 'Therapeutic Sunset',
      'Unearned Confidence', 'Cozy Thunderstorm', 'Perfectly Ripe Avocado',
    ],
  },
  {
    value: 3,
    names: [
      'Perfect Burrito', 'Cloud That Believes in You',
      'Infinite Blanket', 'Enlightened Noodle',
    ],
  },
];

interface SpecialTemplate {
  type: CardType;
  value: number;
  names: string[];
  description: string;
}

const SPECIAL_TEMPLATES: SpecialTemplate[] = [
  {
    type: CardType.Zen, value: 0,
    names: ['Ascended Potato', 'Nirvana Achieved (Temporarily)'],
    description: 'Reset your stress to 0',
  },
  {
    type: CardType.Dump, value: 2,
    names: [
      'Not My Problem', 'Strategic Blame Redistribution', 'Emotional Hot Potato',
      'Plausible Deniability', 'Masterful Deflection', "Someone Else's Crisis",
    ],
    description: 'Transfer 2 stress from you to target',
  },
  {
    type: CardType.Shield, value: 0,
    names: [
      'Emotional Armor', 'Blanket Fort of Denial',
      'Vibes-Only Force Field', 'Blissful Ignorance',
    ],
    description: 'Block the next stress card targeting you',
  },
  {
    type: CardType.Deflect, value: 0,
    names: [
      'Look Behind You!', 'It Was Like That When I Got Here',
      'Classic Misdirection', 'The Old Switcheroo',
    ],
    description: 'Redirect the next stress card targeting you to chosen player',
  },
  {
    type: CardType.Snap, value: 0,
    names: [
      'Caffeine Surge', 'Sudden Clarity Tornado',
      'Adrenaline Dumpling', 'Double Espresso of Doom',
    ],
    description: 'Play this AND another card from your hand',
  },
  {
    type: CardType.ChainReaction, value: 2,
    names: [
      'Domino Theory', 'Cascading Oops',
      'Butterfly Effect Burrito', 'One Thing Led to Another',
    ],
    description: '+2 stress; if target melts down, splash +2 to chosen player',
  },
  {
    type: CardType.Swap, value: 0,
    names: ['Identity Crisis', 'Freaky Friday Juice'],
    description: 'Trade stress levels with any opponent',
  },
  {
    type: CardType.Peek, value: 0,
    names: ['Suspicious Telescope', 'Gossip from the Void'],
    description: "Look at an opponent's hand, then draw 1 extra card",
  },
];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let counter = 0;

  for (const template of STRESS_TEMPLATES) {
    for (const name of template.names) {
      cards.push({
        id: `card_${counter++}`,
        type: CardType.Stress,
        name,
        description: `+${template.value} stress to target`,
        value: template.value,
      });
    }
  }

  for (const template of CHILL_TEMPLATES) {
    for (const name of template.names) {
      cards.push({
        id: `card_${counter++}`,
        type: CardType.Chill,
        name,
        description: `-${template.value} stress`,
        value: template.value,
      });
    }
  }

  for (const template of SPECIAL_TEMPLATES) {
    for (const name of template.names) {
      cards.push({
        id: `card_${counter++}`,
        type: template.type,
        name,
        description: template.description,
        value: template.value,
      });
    }
  }

  return cards;
}

export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd firebase/functions && npx jest test/cards.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/cards.ts firebase/functions/test/cards.test.ts
git commit -m "feat: add 80-card catalog with absurdist names and deck builder"
```

---

### Task 3: Game Lifecycle (Create, Join, Start)

**Files:**
- Create: `firebase/functions/src/lifecycle.ts`
- Create: `firebase/functions/test/lifecycle.test.ts`

- [ ] **Step 1: Write failing tests for game lifecycle**

```typescript
// firebase/functions/test/lifecycle.test.ts
import { createGame, joinGame, startGame, generateRoomCode } from '../src/lifecycle';
import { GameMode, GameStatus } from '../src/types';

describe('generateRoomCode', () => {
  test('returns 4 uppercase letters', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
  });
});

describe('createGame', () => {
  test('creates a game in waiting status with host as first player', () => {
    const { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    expect(gameState.status).toBe(GameStatus.Waiting);
    expect(gameState.players).toEqual(['host1']);
    expect(gameState.playerNames['host1']).toBe('Alice');
    expect(gameState.hostId).toBe('host1');
    expect(gameState.mode).toBe(GameMode.Sync);
    expect(gameState.roomCode).toMatch(/^[A-Z]{4}$/);
    expect(gameState.round).toBe(1);
    expect(gameState.stressLevels).toEqual({});
    expect(serverState.drawPile).toEqual([]);
    expect(serverState.hands).toEqual({});
  });
});

describe('joinGame', () => {
  test('adds a player to a waiting game', () => {
    const { gameState } = createGame('host1', 'Alice', GameMode.Sync);
    const updated = joinGame(gameState, 'player2', 'Bob');
    expect(updated.players).toEqual(['host1', 'player2']);
    expect(updated.playerNames['player2']).toBe('Bob');
  });

  test('rejects join when game is full (4 players)', () => {
    let { gameState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    gameState = joinGame(gameState, 'p3', 'Carol');
    gameState = joinGame(gameState, 'p4', 'Dave');
    expect(() => joinGame(gameState, 'p5', 'Eve')).toThrow('Game is full');
  });

  test('rejects join when game already started', () => {
    let { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    const started = startGame(gameState, serverState, 'host1');
    expect(() => joinGame(started.gameState, 'p3', 'Carol')).toThrow('not accepting');
  });

  test('rejects duplicate player', () => {
    const { gameState } = createGame('host1', 'Alice', GameMode.Sync);
    expect(() => joinGame(gameState, 'host1', 'Alice')).toThrow('Already in game');
  });
});

describe('startGame', () => {
  test('deals 5 cards to each player and sets stress to 3', () => {
    let { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    gameState = joinGame(gameState, 'p3', 'Carol');
    const started = startGame(gameState, serverState, 'host1');

    expect(started.gameState.status).toBe(GameStatus.Active);
    expect(started.gameState.stressLevels['host1']).toBe(3);
    expect(started.gameState.stressLevels['p2']).toBe(3);
    expect(started.gameState.stressLevels['p3']).toBe(3);
    expect(started.serverState.hands['host1']).toHaveLength(5);
    expect(started.serverState.hands['p2']).toHaveLength(5);
    expect(started.serverState.hands['p3']).toHaveLength(5);
    // 80 total - 15 dealt = 65 in draw pile
    expect(started.serverState.drawPile).toHaveLength(65);
    expect(started.serverState.discardPile).toEqual([]);
  });

  test('sets roundsToWin to 5 for 2-player games', () => {
    let { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    const started = startGame(gameState, serverState, 'host1');
    expect(started.gameState.roundsToWin).toBe(5);
  });

  test('sets roundsToWin to 3 for 3-4 player games', () => {
    let { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    gameState = joinGame(gameState, 'p3', 'Carol');
    const started = startGame(gameState, serverState, 'host1');
    expect(started.gameState.roundsToWin).toBe(3);
  });

  test('only host can start', () => {
    let { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    gameState = joinGame(gameState, 'p2', 'Bob');
    expect(() => startGame(gameState, serverState, 'p2')).toThrow('Only the host');
  });

  test('requires at least 2 players', () => {
    const { gameState, serverState } = createGame('host1', 'Alice', GameMode.Sync);
    expect(() => startGame(gameState, serverState, 'host1')).toThrow('at least 2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd firebase/functions && npx jest test/lifecycle.test.ts`
Expected: FAIL — `Cannot find module '../src/lifecycle'`

- [ ] **Step 3: Implement game lifecycle functions**

```typescript
// firebase/functions/src/lifecycle.ts
import { GameState, ServerState, GameMode, GameStatus } from './types';
import { buildDeck, shuffleDeck } from './cards';

const MAX_PLAYERS = 4;

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createGame(
  hostId: string,
  hostName: string,
  mode: GameMode,
): { gameState: GameState; serverState: ServerState } {
  const now = Date.now();
  const gameState: GameState = {
    id: '',
    players: [hostId],
    playerNames: { [hostId]: hostName },
    stressLevels: {},
    currentTurnIndex: 0,
    round: 1,
    roundWins: { [hostId]: 0 },
    roundsToWin: 3,
    status: GameStatus.Waiting,
    mode,
    eliminatedPlayers: [],
    activeEffects: {},
    turnLog: [],
    hostId,
    roomCode: generateRoomCode(),
    isPressurePhase: false,
    turnDeadline: null,
    meltdownPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };

  const serverState: ServerState = {
    drawPile: [],
    discardPile: [],
    hands: {},
  };

  return { gameState, serverState };
}

export function joinGame(state: GameState, playerId: string, playerName: string): GameState {
  if (state.status !== GameStatus.Waiting) {
    throw new Error('Game is not accepting new players');
  }
  if (state.players.includes(playerId)) {
    throw new Error('Already in game');
  }
  if (state.players.length >= MAX_PLAYERS) {
    throw new Error('Game is full');
  }

  return {
    ...state,
    players: [...state.players, playerId],
    playerNames: { ...state.playerNames, [playerId]: playerName },
    roundWins: { ...state.roundWins, [playerId]: 0 },
    updatedAt: Date.now(),
  };
}

export function startGame(
  state: GameState,
  serverState: ServerState,
  requesterId: string,
): { gameState: GameState; serverState: ServerState } {
  if (requesterId !== state.hostId) {
    throw new Error('Only the host can start the game');
  }
  if (state.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }

  const deck = shuffleDeck(buildDeck());
  const hands: Record<string, typeof deck> = {};
  let drawIndex = 0;

  for (const playerId of state.players) {
    hands[playerId] = deck.slice(drawIndex, drawIndex + 5);
    drawIndex += 5;
  }

  const stressLevels: Record<string, number> = {};
  const activeEffects: Record<string, []> = {};
  for (const playerId of state.players) {
    stressLevels[playerId] = 3;
    activeEffects[playerId] = [];
  }

  const firstPlayerIndex = Math.floor(Math.random() * state.players.length);

  return {
    gameState: {
      ...state,
      status: GameStatus.Active,
      stressLevels,
      activeEffects,
      currentTurnIndex: firstPlayerIndex,
      roundsToWin: state.players.length === 2 ? 5 : 3,
      eliminatedPlayers: [],
      turnLog: [],
      isPressurePhase: false,
      meltdownPlayerId: null,
      updatedAt: Date.now(),
    },
    serverState: {
      drawPile: deck.slice(drawIndex),
      discardPile: [],
      hands,
    },
  };
}

export function resetRound(
  state: GameState,
  serverState: ServerState,
): { gameState: GameState; serverState: ServerState } {
  const deck = shuffleDeck(buildDeck());
  const hands: Record<string, typeof deck> = {};
  let drawIndex = 0;

  for (const playerId of state.players) {
    hands[playerId] = deck.slice(drawIndex, drawIndex + 5);
    drawIndex += 5;
  }

  const stressLevels: Record<string, number> = {};
  const activeEffects: Record<string, []> = {};
  for (const playerId of state.players) {
    stressLevels[playerId] = 3;
    activeEffects[playerId] = [];
  }

  const firstPlayerIndex = Math.floor(Math.random() * state.players.length);

  return {
    gameState: {
      ...state,
      status: GameStatus.Active,
      stressLevels,
      activeEffects,
      currentTurnIndex: firstPlayerIndex,
      round: state.round + 1,
      eliminatedPlayers: [],
      turnLog: [],
      isPressurePhase: false,
      meltdownPlayerId: null,
      updatedAt: Date.now(),
    },
    serverState: {
      drawPile: deck.slice(drawIndex),
      discardPile: [],
      hands,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd firebase/functions && npx jest test/lifecycle.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/lifecycle.ts firebase/functions/test/lifecycle.test.ts
git commit -m "feat: add game lifecycle — create, join, start, round reset"
```

---

### Task 4: Core Turn Loop (Draw, Play Stress/Chill/Zen)

**Files:**
- Create: `firebase/functions/src/engine.ts`
- Create: `firebase/functions/test/engine.test.ts`

- [ ] **Step 1: Write failing tests for core engine**

```typescript
// firebase/functions/test/engine.test.ts
import { drawCard, playCard } from '../src/engine';
import { createGame, joinGame, startGame } from '../src/lifecycle';
import { GameState, ServerState, GameMode, GameStatus, CardType, Card } from '../src/types';

// Helper to set up a started 3-player game
function setupGame(): { gameState: GameState; serverState: ServerState } {
  let { gameState, serverState } = createGame('p1', 'Alice', GameMode.Sync);
  gameState = joinGame(gameState, 'p2', 'Bob');
  gameState = joinGame(gameState, 'p3', 'Carol');
  return startGame(gameState, serverState, 'p1');
}

// Helper to create a card for testing
function makeCard(type: CardType, value: number, id = 'test_card'): Card {
  return { id, type, name: 'Test Card', description: 'test', value };
}

describe('drawCard', () => {
  test('moves top card from draw pile to player hand', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const topCard = serverState.drawPile[0];
    const handBefore = serverState.hands[currentPlayer].length;

    const result = drawCard(gameState, serverState, currentPlayer);

    expect(result.serverState.hands[currentPlayer]).toHaveLength(handBefore + 1);
    expect(result.serverState.hands[currentPlayer]).toContainEqual(topCard);
    expect(result.serverState.drawPile).toHaveLength(serverState.drawPile.length - 1);
  });

  test('enters pressure phase when draw pile is empty', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    // Empty the draw pile, fill discard
    serverState.discardPile = [...serverState.drawPile];
    serverState.drawPile = [];

    const result = drawCard(gameState, serverState, currentPlayer);

    expect(result.gameState.isPressurePhase).toBe(true);
    // Draw pile should be refilled from discard (minus the drawn card)
    expect(result.serverState.drawPile.length).toBeGreaterThan(0);
    expect(result.serverState.discardPile).toHaveLength(0);
  });
});

describe('playCard — stress', () => {
  test('adds stress to target player', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const target = gameState.players.find(p => p !== currentPlayer)!;

    // Give current player a +2 stress card
    const stressCard = makeCard(CardType.Stress, 2, 'stress2');
    serverState.hands[currentPlayer].push(stressCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'stress2',
      targetId: target,
    });

    expect(result.gameState.stressLevels[target]).toBe(3 + 2); // started at 3
  });

  test('removes card from hand and adds to discard', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const target = gameState.players.find(p => p !== currentPlayer)!;

    const stressCard = makeCard(CardType.Stress, 1, 'stress1');
    serverState.hands[currentPlayer] = [stressCard];

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'stress1',
      targetId: target,
    });

    expect(result.serverState.hands[currentPlayer]).toHaveLength(0);
    expect(result.serverState.discardPile).toContainEqual(stressCard);
  });

  test('rejects playing on yourself with a stress card', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    const stressCard = makeCard(CardType.Stress, 1, 'stress1');
    serverState.hands[currentPlayer] = [stressCard];

    expect(() => playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'stress1',
      targetId: currentPlayer,
    })).toThrow();
  });

  test('rejects playing card not in hand', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];

    expect(() => playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'nonexistent',
      targetId: 'p2',
    })).toThrow('not in your hand');
  });
});

describe('playCard — chill', () => {
  test('reduces own stress', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    gameState.stressLevels[currentPlayer] = 5;

    const chillCard = makeCard(CardType.Chill, 2, 'chill2');
    serverState.hands[currentPlayer].push(chillCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'chill2',
    });

    expect(result.gameState.stressLevels[currentPlayer]).toBe(3); // 5 - 2
  });

  test('stress cannot go below 0', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    gameState.stressLevels[currentPlayer] = 1;

    const chillCard = makeCard(CardType.Chill, 3, 'chill3');
    serverState.hands[currentPlayer].push(chillCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'chill3',
    });

    expect(result.gameState.stressLevels[currentPlayer]).toBe(0);
  });
});

describe('playCard — zen', () => {
  test('resets own stress to 0', () => {
    let { gameState, serverState } = setupGame();
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    gameState.stressLevels[currentPlayer] = 9;

    const zenCard = makeCard(CardType.Zen, 0, 'zen1');
    serverState.hands[currentPlayer].push(zenCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'zen1',
    });

    expect(result.gameState.stressLevels[currentPlayer]).toBe(0);
  });
});

describe('turn advancement', () => {
  test('advances to next player after card play', () => {
    let { gameState, serverState } = setupGame();
    gameState.currentTurnIndex = 0;
    const currentPlayer = gameState.players[0];
    const nextPlayer = gameState.players[1];

    const chillCard = makeCard(CardType.Chill, 1, 'chill1');
    serverState.hands[currentPlayer].push(chillCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'chill1',
    });

    expect(gameState.players[result.gameState.currentTurnIndex]).toBe(nextPlayer);
  });

  test('skips eliminated players', () => {
    let { gameState, serverState } = setupGame();
    gameState.currentTurnIndex = 0;
    gameState.eliminatedPlayers = [gameState.players[1]];

    const currentPlayer = gameState.players[0];
    const chillCard = makeCard(CardType.Chill, 1, 'chill1');
    serverState.hands[currentPlayer].push(chillCard);

    const result = playCard(gameState, serverState, currentPlayer, {
      gameId: gameState.id,
      cardId: 'chill1',
    });

    // Should skip p2 (eliminated) and go to p3
    expect(gameState.players[result.gameState.currentTurnIndex]).toBe(gameState.players[2]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd firebase/functions && npx jest test/engine.test.ts`
Expected: FAIL — `Cannot find module '../src/engine'`

- [ ] **Step 3: Implement core engine**

```typescript
// firebase/functions/src/engine.ts
import {
  GameState, ServerState, GameStatus, Card, CardType,
  PlayCardRequest, TurnLogEntry, GameEvent, ActiveEffect,
} from './types';

export function drawCard(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
): { gameState: GameState; serverState: ServerState; drawnCard: Card } {
  let gs = { ...gameState };
  let ss = { ...serverState, drawPile: [...serverState.drawPile], hands: { ...serverState.hands } };
  ss.hands[playerId] = [...ss.hands[playerId]];

  // If draw pile is empty, shuffle discard into draw pile and enter pressure phase
  if (ss.drawPile.length === 0) {
    const shuffled = [...ss.discardPile];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    ss.drawPile = shuffled;
    ss.discardPile = [];
    gs = { ...gs, isPressurePhase: true };
  }

  const card = ss.drawPile.shift()!;
  ss.hands[playerId].push(card);

  return { gameState: gs, serverState: ss, drawnCard: card };
}

function advanceTurn(state: GameState): GameState {
  const activePlayers = state.players.filter(p => !state.eliminatedPlayers.includes(p));
  if (activePlayers.length <= 1) return state;

  let nextIndex = state.currentTurnIndex;
  do {
    nextIndex = (nextIndex + 1) % state.players.length;
  } while (state.eliminatedPlayers.includes(state.players[nextIndex]));

  // Expire active effects for the player whose turn just ended
  const currentPlayerId = state.players[state.currentTurnIndex];
  const updatedEffects = { ...state.activeEffects };
  for (const pid of Object.keys(updatedEffects)) {
    updatedEffects[pid] = updatedEffects[pid].filter(
      (e) => e.expiresAfterTurnOf !== currentPlayerId
    );
  }

  return { ...state, currentTurnIndex: nextIndex, activeEffects: updatedEffects };
}

function applyStress(
  gameState: GameState,
  serverState: ServerState,
  targetId: string,
  amount: number,
  sourcePlayerId: string,
  cardName: string,
): { gameState: GameState; serverState: ServerState; events: GameEvent[]; meltdownTriggered: boolean } {
  const events: GameEvent[] = [];
  let gs = { ...gameState, stressLevels: { ...gameState.stressLevels } };
  let ss = serverState;

  // Check for Shield
  const targetEffects = gs.activeEffects[targetId] || [];
  const shieldIndex = targetEffects.findIndex(e => e.type === 'shield');
  if (shieldIndex >= 0) {
    const updatedEffects = { ...gs.activeEffects };
    updatedEffects[targetId] = targetEffects.filter((_, i) => i !== shieldIndex);
    gs = { ...gs, activeEffects: updatedEffects };
    events.push({
      type: 'shieldBlocked',
      playerId: targetId,
      cardName,
      description: `${gs.playerNames[targetId]}'s shield blocked ${cardName}!`,
    });
    return { gameState: gs, serverState: ss, events, meltdownTriggered: false };
  }

  // Check for Deflect
  const deflectIndex = targetEffects.findIndex(e => e.type === 'deflect');
  if (deflectIndex >= 0) {
    const deflect = targetEffects[deflectIndex];
    const redirectTo = deflect.redirectTargetId!;
    const updatedEffects = { ...gs.activeEffects };
    updatedEffects[targetId] = targetEffects.filter((_, i) => i !== deflectIndex);
    gs = { ...gs, activeEffects: updatedEffects };
    events.push({
      type: 'deflected',
      playerId: targetId,
      targetId: redirectTo,
      cardName,
      description: `${gs.playerNames[targetId]} deflected ${cardName} to ${gs.playerNames[redirectTo]}!`,
    });
    // Recursively apply to the redirect target (but they can also have shield/deflect)
    return applyStress(gs, ss, redirectTo, amount, sourcePlayerId, cardName);
  }

  // Apply stress
  const oldStress = gs.stressLevels[targetId];
  const newStress = Math.min(oldStress + amount, 10);
  gs.stressLevels[targetId] = newStress;
  events.push({
    type: 'stressChanged',
    playerId: targetId,
    oldStress,
    newStress,
    damage: amount,
    description: `${gs.playerNames[targetId]}: ${oldStress} → ${newStress} stress`,
  });

  const meltdownTriggered = newStress >= 10;

  return { gameState: gs, serverState: ss, events, meltdownTriggered };
}

export function playCard(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
  request: PlayCardRequest,
): { gameState: GameState; serverState: ServerState; events: GameEvent[] } {
  if (gameState.status !== GameStatus.Active) {
    throw new Error('Game is not active');
  }
  if (gameState.players[gameState.currentTurnIndex] !== playerId) {
    throw new Error('Not your turn');
  }

  const hand = serverState.hands[playerId];
  const cardIndex = hand.findIndex(c => c.id === request.cardId);
  if (cardIndex < 0) {
    throw new Error('Card not in your hand');
  }

  const card = hand[cardIndex];
  let gs = { ...gameState, stressLevels: { ...gameState.stressLevels } };
  let ss = {
    ...serverState,
    hands: { ...serverState.hands },
    discardPile: [...serverState.discardPile],
  };
  ss.hands[playerId] = [...ss.hands[playerId]];
  const events: GameEvent[] = [];

  // Remove card from hand, add to discard
  ss.hands[playerId].splice(cardIndex, 1);
  ss.discardPile.push(card);

  // Validate target for cards that need one
  const targetRequiredTypes = [CardType.Stress, CardType.Dump, CardType.ChainReaction, CardType.Swap, CardType.Peek];
  if (targetRequiredTypes.includes(card.type)) {
    if (!request.targetId) throw new Error('Target required');
    if (!gs.players.includes(request.targetId)) throw new Error('Invalid target');
    if (gs.eliminatedPlayers.includes(request.targetId)) throw new Error('Target is eliminated');
  }
  if (card.type === CardType.Stress && request.targetId === playerId) {
    throw new Error('Cannot stress yourself');
  }
  if (card.type === CardType.Dump && request.targetId === playerId) {
    throw new Error('Cannot dump on yourself');
  }

  // Execute card effect
  switch (card.type) {
    case CardType.Stress: {
      const stressResult = applyStress(gs, ss, request.targetId!, card.value, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        gs = {
          ...gs,
          status: GameStatus.MeltdownPending,
          meltdownPlayerId: request.targetId!,
          eliminatedPlayers: [...gs.eliminatedPlayers, request.targetId!],
        };
        events.push({
          type: 'meltdown',
          playerId: request.targetId!,
          description: `${gs.playerNames[request.targetId!]} MELTED DOWN!`,
        });
        // Add turn log and return — don't advance turn yet (tantrum pending)
        gs.turnLog = [...gs.turnLog, {
          playerId,
          cardName: card.name,
          cardType: card.type,
          targetId: request.targetId,
          stressChange: card.value,
          description: `${gs.playerNames[playerId]} played ${card.name} on ${gs.playerNames[request.targetId!]}`,
        }];
        gs.updatedAt = Date.now();
        return { gameState: gs, serverState: ss, events };
      }
      break;
    }

    case CardType.Chill: {
      const oldStress = gs.stressLevels[playerId];
      gs.stressLevels[playerId] = Math.max(0, oldStress - card.value);
      events.push({
        type: 'stressChanged',
        playerId,
        oldStress,
        newStress: gs.stressLevels[playerId],
        description: `${gs.playerNames[playerId]}: ${oldStress} → ${gs.stressLevels[playerId]} stress`,
      });
      break;
    }

    case CardType.Zen: {
      const oldStress = gs.stressLevels[playerId];
      gs.stressLevels[playerId] = 0;
      events.push({
        type: 'zenPlayed',
        playerId,
        oldStress,
        newStress: 0,
        description: `${gs.playerNames[playerId]} played ${card.name}! Stress: ${oldStress} → 0!`,
      });
      break;
    }

    case CardType.Dump: {
      const target = request.targetId!;
      const oldSelf = gs.stressLevels[playerId];
      const oldTarget = gs.stressLevels[target];
      gs.stressLevels[playerId] = Math.max(0, oldSelf - card.value);
      const stressResult = applyStress(gs, ss, target, card.value, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push({
        type: 'stressChanged',
        playerId,
        oldStress: oldSelf,
        newStress: gs.stressLevels[playerId],
        description: `${gs.playerNames[playerId]} dumped stress: ${oldSelf} → ${gs.stressLevels[playerId]}`,
      });
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        gs = {
          ...gs,
          status: GameStatus.MeltdownPending,
          meltdownPlayerId: target,
          eliminatedPlayers: [...gs.eliminatedPlayers, target],
        };
        events.push({
          type: 'meltdown',
          playerId: target,
          description: `${gs.playerNames[target]} MELTED DOWN!`,
        });
        gs.turnLog = [...gs.turnLog, {
          playerId,
          cardName: card.name,
          cardType: card.type,
          targetId: target,
          stressChange: card.value,
          description: `${gs.playerNames[playerId]} played ${card.name} on ${gs.playerNames[target]}`,
        }];
        gs.updatedAt = Date.now();
        return { gameState: gs, serverState: ss, events };
      }
      break;
    }

    case CardType.Shield: {
      const effect: ActiveEffect = {
        type: 'shield',
        expiresAfterTurnOf: playerId,
      };
      const updatedEffects = { ...gs.activeEffects };
      updatedEffects[playerId] = [...(updatedEffects[playerId] || []), effect];
      gs = { ...gs, activeEffects: updatedEffects };
      events.push({
        type: 'cardPlayed',
        playerId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} activated ${card.name}!`,
      });
      break;
    }

    case CardType.Deflect: {
      if (!request.deflectRedirectTargetId) throw new Error('Deflect requires a redirect target');
      if (request.deflectRedirectTargetId === playerId) throw new Error('Cannot deflect to yourself');
      const effect: ActiveEffect = {
        type: 'deflect',
        redirectTargetId: request.deflectRedirectTargetId,
        expiresAfterTurnOf: playerId,
      };
      const updatedEffects = { ...gs.activeEffects };
      updatedEffects[playerId] = [...(updatedEffects[playerId] || []), effect];
      gs = { ...gs, activeEffects: updatedEffects };
      events.push({
        type: 'cardPlayed',
        playerId,
        targetId: request.deflectRedirectTargetId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} is deflecting to ${gs.playerNames[request.deflectRedirectTargetId]}!`,
      });
      break;
    }

    case CardType.Swap: {
      const target = request.targetId!;
      if (target === playerId) throw new Error('Cannot swap with yourself');
      const playerStress = gs.stressLevels[playerId];
      const targetStress = gs.stressLevels[target];
      gs.stressLevels[playerId] = targetStress;
      gs.stressLevels[target] = playerStress;
      events.push({
        type: 'swapped',
        playerId,
        targetId: target,
        description: `${gs.playerNames[playerId]} swapped stress with ${gs.playerNames[target]}! (${playerStress} ↔ ${targetStress})`,
      });

      // Check if swap caused a meltdown (player swapped INTO 10+)
      if (gs.stressLevels[target] >= 10) {
        gs = {
          ...gs,
          status: GameStatus.MeltdownPending,
          meltdownPlayerId: target,
          eliminatedPlayers: [...gs.eliminatedPlayers, target],
        };
        events.push({
          type: 'meltdown',
          playerId: target,
          description: `${gs.playerNames[target]} MELTED DOWN from the swap!`,
        });
        gs.turnLog = [...gs.turnLog, {
          playerId,
          cardName: card.name,
          cardType: card.type,
          targetId: target,
          description: `${gs.playerNames[playerId]} played ${card.name} on ${gs.playerNames[target]}`,
        }];
        gs.updatedAt = Date.now();
        return { gameState: gs, serverState: ss, events };
      }
      if (gs.stressLevels[playerId] >= 10) {
        gs = {
          ...gs,
          status: GameStatus.MeltdownPending,
          meltdownPlayerId: playerId,
          eliminatedPlayers: [...gs.eliminatedPlayers, playerId],
        };
        events.push({
          type: 'meltdown',
          playerId,
          description: `${gs.playerNames[playerId]} MELTED DOWN from the swap!`,
        });
        gs.turnLog = [...gs.turnLog, {
          playerId,
          cardName: card.name,
          cardType: card.type,
          targetId: target,
          description: `${gs.playerNames[playerId]} played ${card.name} on ${gs.playerNames[target]}`,
        }];
        gs.updatedAt = Date.now();
        return { gameState: gs, serverState: ss, events };
      }
      break;
    }

    case CardType.Peek: {
      const target = request.targetId!;
      if (target === playerId) throw new Error('Cannot peek at yourself');
      events.push({
        type: 'peeked',
        playerId,
        targetId: target,
        description: `${gs.playerNames[playerId]} peeked at ${gs.playerNames[target]}'s hand!`,
      });
      // Draw an extra card
      if (ss.drawPile.length > 0) {
        const drawn = drawCard(gs, ss, playerId);
        gs = drawn.gameState;
        ss = drawn.serverState;
      }
      break;
    }

    case CardType.Snap: {
      if (!request.snapFollowUp) throw new Error('Snap requires a follow-up card');
      if (request.snapFollowUp.cardId === request.cardId) throw new Error('Cannot snap the same card');
      // Check the follow-up card is in hand
      const followUpIndex = ss.hands[playerId].findIndex(c => c.id === request.snapFollowUp!.cardId);
      if (followUpIndex < 0) throw new Error('Follow-up card not in hand');
      const followUpCard = ss.hands[playerId][followUpIndex];
      if (followUpCard.type === CardType.Snap) throw new Error('Cannot snap into another snap');

      events.push({
        type: 'cardPlayed',
        playerId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} played ${card.name} — double action!`,
      });

      // Play the follow-up card using the same playCard logic
      const followUpResult = playCard(gs, ss, playerId, {
        ...request.snapFollowUp,
        gameId: request.gameId,
      });
      // If the follow-up triggered a meltdown, propagate the state
      return {
        gameState: followUpResult.gameState,
        serverState: followUpResult.serverState,
        events: [...events, ...followUpResult.events],
      };
    }

    case CardType.ChainReaction: {
      const target = request.targetId!;
      if (!request.chainReactionSplashTargetId) throw new Error('Chain Reaction requires a splash target');
      if (target === playerId) throw new Error('Cannot chain reaction yourself');

      const stressResult = applyStress(gs, ss, target, card.value, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        // Apply splash damage
        const splashTarget = request.chainReactionSplashTargetId;
        if (splashTarget && !gs.eliminatedPlayers.includes(splashTarget) && splashTarget !== target) {
          const splashResult = applyStress(gs, ss, splashTarget, 2, playerId, 'Chain Reaction splash');
          gs = splashResult.gameState;
          ss = splashResult.serverState;
          events.push({
            type: 'chainMeltdown',
            playerId: target,
            targetId: splashTarget,
            damage: 2,
            description: `Chain Reaction! +2 splash to ${gs.playerNames[splashTarget]}!`,
          });
          events.push(...splashResult.events);

          // Check splash target meltdown — handle after primary meltdown tantrum
          // For now, queue the primary meltdown
        }

        gs = {
          ...gs,
          status: GameStatus.MeltdownPending,
          meltdownPlayerId: target,
          eliminatedPlayers: [...gs.eliminatedPlayers, target],
        };
        events.push({
          type: 'meltdown',
          playerId: target,
          description: `${gs.playerNames[target]} MELTED DOWN!`,
        });
        gs.turnLog = [...gs.turnLog, {
          playerId,
          cardName: card.name,
          cardType: card.type,
          targetId: target,
          stressChange: card.value,
          description: `${gs.playerNames[playerId]} played ${card.name} on ${gs.playerNames[target]}`,
        }];
        gs.updatedAt = Date.now();
        return { gameState: gs, serverState: ss, events };
      }
      break;
    }
  }

  // Add turn log entry
  gs.turnLog = [...gs.turnLog, {
    playerId,
    cardName: card.name,
    cardType: card.type,
    targetId: request.targetId,
    stressChange: card.type === CardType.Stress ? card.value :
                  card.type === CardType.Chill ? -card.value : undefined,
    description: `${gs.playerNames[playerId]} played ${card.name}`,
  }];

  // Advance turn
  gs = advanceTurn(gs);
  gs.updatedAt = Date.now();

  return { gameState: gs, serverState: ss, events };
}

// Apply pressure phase stress (+1 to all active players at start of turn cycle)
export function applyPressure(
  gameState: GameState,
  serverState: ServerState,
): { gameState: GameState; serverState: ServerState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let gs = { ...gameState, stressLevels: { ...gameState.stressLevels } };
  let meltdownPlayer: string | null = null;

  for (const pid of gs.players) {
    if (gs.eliminatedPlayers.includes(pid)) continue;
    const old = gs.stressLevels[pid];
    gs.stressLevels[pid] = Math.min(old + 1, 10);
    events.push({
      type: 'pressurePhase',
      playerId: pid,
      oldStress: old,
      newStress: gs.stressLevels[pid],
      description: `Pressure! ${gs.playerNames[pid]}: ${old} → ${gs.stressLevels[pid]}`,
    });
    if (gs.stressLevels[pid] >= 10 && !meltdownPlayer) {
      meltdownPlayer = pid;
    }
  }

  if (meltdownPlayer) {
    gs = {
      ...gs,
      status: GameStatus.MeltdownPending,
      meltdownPlayerId: meltdownPlayer,
      eliminatedPlayers: [...gs.eliminatedPlayers, meltdownPlayer],
    };
    events.push({
      type: 'meltdown',
      playerId: meltdownPlayer,
      description: `${gs.playerNames[meltdownPlayer]} MELTED DOWN from pressure!`,
    });
  }

  return { gameState: gs, serverState, events };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd firebase/functions && npx jest test/engine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/engine.ts firebase/functions/test/engine.test.ts
git commit -m "feat: implement core game engine — draw, play, stress, chill, zen, all specials"
```

---

### Task 5: Meltdown + Tantrum + Chain Resolution

**Files:**
- Create: `firebase/functions/src/meltdown.ts`
- Create: `firebase/functions/test/meltdown.test.ts`

- [ ] **Step 1: Write failing tests for meltdown resolution**

```typescript
// firebase/functions/test/meltdown.test.ts
import { playTantrum, checkRoundEnd } from '../src/meltdown';
import { createGame, joinGame, startGame } from '../src/lifecycle';
import { GameState, ServerState, GameMode, GameStatus, CardType, Card } from '../src/types';

function makeCard(type: CardType, value: number, id: string): Card {
  return { id, type, name: 'Test', description: 'test', value };
}

function setup3pGame(): { gameState: GameState; serverState: ServerState } {
  let { gameState, serverState } = createGame('p1', 'Alice', GameMode.Sync);
  gameState = joinGame(gameState, 'p2', 'Bob');
  gameState = joinGame(gameState, 'p3', 'Carol');
  return startGame(gameState, serverState, 'p1');
}

describe('playTantrum', () => {
  test('stress card deals double damage', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';
    gameState.eliminatedPlayers = ['p1'];
    gameState.stressLevels['p2'] = 3;

    const stressCard = makeCard(CardType.Stress, 4, 'big_stress');
    serverState.hands['p1'] = [stressCard];

    const result = playTantrum(gameState, serverState, 'p1', {
      gameId: gameState.id,
      cardId: 'big_stress',
      targetId: 'p2',
    });

    // +4 doubled = +8
    expect(result.gameState.stressLevels['p2']).toBe(3 + 8);
  });

  test('non-stress card deals 3 stress', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';
    gameState.eliminatedPlayers = ['p1'];
    gameState.stressLevels['p2'] = 5;

    const shieldCard = makeCard(CardType.Shield, 0, 'shield1');
    serverState.hands['p1'] = [shieldCard];

    const result = playTantrum(gameState, serverState, 'p1', {
      gameId: gameState.id,
      cardId: 'shield1',
      targetId: 'p2',
    });

    expect(result.gameState.stressLevels['p2']).toBe(5 + 3);
  });

  test('tantrum can trigger chain meltdown', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';
    gameState.eliminatedPlayers = ['p1'];
    gameState.stressLevels['p2'] = 9;

    const stressCard = makeCard(CardType.Stress, 1, 's1');
    serverState.hands['p1'] = [stressCard];

    const result = playTantrum(gameState, serverState, 'p1', {
      gameId: gameState.id,
      cardId: 's1',
      targetId: 'p2',
    });

    // +1 doubled = +2, p2 was at 9 → 11 → meltdown
    expect(result.gameState.eliminatedPlayers).toContain('p2');
    expect(result.gameState.status).toBe(GameStatus.MeltdownPending);
    expect(result.gameState.meltdownPlayerId).toBe('p2');
  });

  test('only meltdown player can play tantrum', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';

    const card = makeCard(CardType.Chill, 1, 'c1');
    serverState.hands['p2'] = [card];

    expect(() => playTantrum(gameState, serverState, 'p2', {
      gameId: gameState.id,
      cardId: 'c1',
      targetId: 'p3',
    })).toThrow('Not your tantrum');
  });

  test('cannot target eliminated player', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';
    gameState.eliminatedPlayers = ['p1', 'p3'];

    const card = makeCard(CardType.Stress, 1, 's1');
    serverState.hands['p1'] = [card];

    expect(() => playTantrum(gameState, serverState, 'p1', {
      gameId: gameState.id,
      cardId: 's1',
      targetId: 'p3',
    })).toThrow('eliminated');
  });
});

describe('checkRoundEnd', () => {
  test('returns winner when only 1 player remains', () => {
    let { gameState } = setup3pGame();
    gameState.eliminatedPlayers = ['p1', 'p2'];
    const result = checkRoundEnd(gameState);
    expect(result.isOver).toBe(true);
    expect(result.winnerId).toBe('p3');
  });

  test('returns not over when 2+ players remain', () => {
    let { gameState } = setup3pGame();
    gameState.eliminatedPlayers = ['p1'];
    const result = checkRoundEnd(gameState);
    expect(result.isOver).toBe(false);
  });

  test('detects game win when player reaches roundsToWin', () => {
    let { gameState } = setup3pGame();
    gameState.roundsToWin = 3;
    gameState.roundWins = { p1: 0, p2: 2, p3: 0 };
    gameState.eliminatedPlayers = ['p1', 'p3'];
    const result = checkRoundEnd(gameState);
    expect(result.isOver).toBe(true);
    expect(result.winnerId).toBe('p2');
    expect(result.isGameOver).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd firebase/functions && npx jest test/meltdown.test.ts`
Expected: FAIL — `Cannot find module '../src/meltdown'`

- [ ] **Step 3: Implement meltdown resolution**

```typescript
// firebase/functions/src/meltdown.ts
import {
  GameState, ServerState, GameStatus, CardType,
  TantrumRequest, GameEvent,
} from './types';

export function playTantrum(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
  request: TantrumRequest,
): { gameState: GameState; serverState: ServerState; events: GameEvent[] } {
  if (gameState.status !== GameStatus.MeltdownPending) {
    throw new Error('No meltdown pending');
  }
  if (gameState.meltdownPlayerId !== playerId) {
    throw new Error('Not your tantrum');
  }

  const hand = serverState.hands[playerId];
  const cardIndex = hand.findIndex(c => c.id === request.cardId);
  if (cardIndex < 0) {
    throw new Error('Card not in your hand');
  }
  if (gameState.eliminatedPlayers.includes(request.targetId)) {
    throw new Error('Cannot target eliminated player');
  }
  if (request.targetId === playerId) {
    throw new Error('Cannot target yourself');
  }

  const card = hand[cardIndex];
  const events: GameEvent[] = [];
  let gs = { ...gameState, stressLevels: { ...gameState.stressLevels } };
  let ss = {
    ...serverState,
    hands: { ...serverState.hands },
    discardPile: [...serverState.discardPile],
  };
  ss.hands[playerId] = [...ss.hands[playerId]];
  ss.hands[playerId].splice(cardIndex, 1);
  ss.discardPile.push(card);

  // Calculate tantrum damage
  const damage = card.type === CardType.Stress ? card.value * 2 : 3;

  const oldStress = gs.stressLevels[request.targetId];
  const newStress = Math.min(oldStress + damage, 10);
  gs.stressLevels[request.targetId] = newStress;

  events.push({
    type: 'tantrum',
    playerId,
    targetId: request.targetId,
    cardName: card.name,
    damage,
    oldStress,
    newStress,
    description: `TANTRUM! ${gs.playerNames[playerId]} dealt ${damage} stress to ${gs.playerNames[request.targetId]} with ${card.name}!`,
  });

  // Check if tantrum caused another meltdown (chain meltdown)
  if (newStress >= 10) {
    gs = {
      ...gs,
      meltdownPlayerId: request.targetId,
      eliminatedPlayers: [...gs.eliminatedPlayers, request.targetId],
    };
    events.push({
      type: 'chainMeltdown',
      playerId: request.targetId,
      description: `CHAIN MELTDOWN! ${gs.playerNames[request.targetId]} also melted down!`,
    });
    gs.updatedAt = Date.now();
    // Status stays MeltdownPending for the chain tantrum
    return { gameState: gs, serverState: ss, events };
  }

  // No chain — resolve meltdown, check round end
  const roundResult = checkRoundEnd(gs);
  if (roundResult.isOver) {
    gs.roundWins = { ...gs.roundWins };
    gs.roundWins[roundResult.winnerId!] = (gs.roundWins[roundResult.winnerId!] || 0) + 1;

    if (roundResult.isGameOver) {
      gs.status = GameStatus.GameEnd;
      events.push({
        type: 'gameEnd',
        playerId: roundResult.winnerId!,
        description: `GAME OVER! ${gs.playerNames[roundResult.winnerId!]} wins the game!`,
      });
    } else {
      gs.status = GameStatus.RoundEnd;
      events.push({
        type: 'roundEnd',
        playerId: roundResult.winnerId!,
        description: `Round ${gs.round} over! ${gs.playerNames[roundResult.winnerId!]} wins!`,
      });
    }
  } else {
    // Resume normal play
    gs.status = GameStatus.Active;
    gs.meltdownPlayerId = null;
    // Advance turn from where we left off
    const activePlayers = gs.players.filter(p => !gs.eliminatedPlayers.includes(p));
    if (activePlayers.length > 1) {
      let nextIndex = gs.currentTurnIndex;
      do {
        nextIndex = (nextIndex + 1) % gs.players.length;
      } while (gs.eliminatedPlayers.includes(gs.players[nextIndex]));
      gs.currentTurnIndex = nextIndex;
    }
  }

  gs.updatedAt = Date.now();
  return { gameState: gs, serverState: ss, events };
}

export function checkRoundEnd(
  gameState: GameState,
): { isOver: boolean; winnerId?: string; isGameOver?: boolean } {
  const activePlayers = gameState.players.filter(
    p => !gameState.eliminatedPlayers.includes(p),
  );

  if (activePlayers.length > 1) {
    return { isOver: false };
  }

  const winnerId = activePlayers[0];
  const newWins = (gameState.roundWins[winnerId] || 0) + 1;
  const isGameOver = newWins >= gameState.roundsToWin;

  return { isOver: true, winnerId, isGameOver };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd firebase/functions && npx jest test/meltdown.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `cd firebase/functions && npx jest`
Expected: All test files PASS.

- [ ] **Step 6: Commit**

```bash
git add firebase/functions/src/meltdown.ts firebase/functions/test/meltdown.test.ts
git commit -m "feat: implement meltdown tantrum resolution with chain meltdown support"
```

---

### Task 6: Cloud Function Endpoints

**Files:**
- Create: `firebase/functions/src/notifications.ts`
- Create: `firebase/functions/src/index.ts`

- [ ] **Step 1: Create notification composer**

```typescript
// firebase/functions/src/notifications.ts
import { GameState, GameEvent } from './types';

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export function composeTurnNotification(
  gameState: GameState,
  playerId: string,
  lastEvent?: GameEvent,
): { title: string; body: string } {
  const playerName = gameState.playerNames[playerId];
  const stress = gameState.stressLevels[playerId];

  if (lastEvent && lastEvent.type === 'stressChanged' && lastEvent.playerId === playerId) {
    return {
      title: 'Get Decked',
      body: `${lastEvent.cardName || 'A card'} hit you! Stress: ${stress}/10. Your turn!`,
    };
  }

  if (lastEvent && lastEvent.type === 'meltdown') {
    return {
      title: 'MELTDOWN!',
      body: `${gameState.playerNames[lastEvent.playerId!]} melted down! Your turn, ${playerName}.`,
    };
  }

  return {
    title: 'Get Decked',
    body: `Your turn, ${playerName}! Stress: ${stress}/10.`,
  };
}

export function composeMeltdownNotification(
  gameState: GameState,
  meltdownPlayerId: string,
): { title: string; body: string } {
  return {
    title: 'You MELTED DOWN!',
    body: 'Choose a card for your tantrum — make them pay!',
  };
}

export function composeRoundEndNotification(
  gameState: GameState,
  winnerId: string,
  playerId: string,
): { title: string; body: string } {
  const winnerName = gameState.playerNames[winnerId];
  if (playerId === winnerId) {
    return {
      title: 'You won the round!',
      body: `Round ${gameState.round} is yours. Wins: ${(gameState.roundWins[winnerId] || 0) + 1}/${gameState.roundsToWin}.`,
    };
  }
  return {
    title: `${winnerName} won round ${gameState.round}`,
    body: `${winnerName} kept their cool. Next round starting soon!`,
  };
}

export function composeShareMessage(
  gameState: GameState,
  events: GameEvent[],
): string {
  const meltdownEvent = events.find(e => e.type === 'meltdown');
  const tantrumEvent = events.find(e => e.type === 'tantrum');

  if (meltdownEvent && tantrumEvent) {
    return `🔥 MELTDOWN in Get Decked! ${meltdownEvent.description} ${tantrumEvent.description}`;
  }

  const zenEvent = events.find(e => e.type === 'zenPlayed');
  if (zenEvent) {
    return `🧘 ZEN in Get Decked! ${zenEvent.description}`;
  }

  const swapEvent = events.find(e => e.type === 'swapped');
  if (swapEvent) {
    return `🔄 SWAP in Get Decked! ${swapEvent.description}`;
  }

  return '';
}
```

- [ ] **Step 2: Create Cloud Function endpoints**

```typescript
// firebase/functions/src/index.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { GameState, ServerState, GameMode, GameStatus, PlayCardRequest, TantrumRequest } from './types';
import { createGame, joinGame, startGame, resetRound } from './lifecycle';
import { drawCard, playCard } from './engine';
import { playTantrum } from './meltdown';
import { composeTurnNotification, composeMeltdownNotification } from './notifications';

initializeApp();
const db = getFirestore();

// --- Callable Functions ---

export const createGameFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { mode, displayName } = request.data as { mode: string; displayName: string };
  const gameMode = mode === 'async' ? GameMode.Async : GameMode.Sync;
  const { gameState, serverState } = createGame(uid, displayName, gameMode);

  const gameRef = db.collection('games').doc();
  const id = gameRef.id;
  const gs = { ...gameState, id };

  await gameRef.set(gs);
  await gameRef.collection('server').doc('state').set(serverState);
  await gameRef.collection('hands').doc(uid).set({ cards: [] });

  return { gameId: id, roomCode: gs.roomCode };
});

export const joinGameFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { roomCode, displayName } = request.data as { roomCode: string; displayName: string };

  const snapshot = await db.collection('games')
    .where('roomCode', '==', roomCode.toUpperCase())
    .where('status', '==', GameStatus.Waiting)
    .limit(1)
    .get();

  if (snapshot.empty) throw new HttpsError('not-found', 'Game not found');

  const gameRef = snapshot.docs[0].ref;
  const gameState = snapshot.docs[0].data() as GameState;

  const updated = joinGame(gameState, uid, displayName);
  await gameRef.update({
    players: updated.players,
    playerNames: updated.playerNames,
    roundWins: updated.roundWins,
    updatedAt: Date.now(),
  });
  await gameRef.collection('hands').doc(uid).set({ cards: [] });

  return { gameId: gameRef.id };
});

export const startGameFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data as { gameId: string };
  const gameRef = db.collection('games').doc(gameId);

  await db.runTransaction(async (txn) => {
    const gameDoc = await txn.get(gameRef);
    if (!gameDoc.exists) throw new HttpsError('not-found', 'Game not found');

    const gameState = gameDoc.data() as GameState;
    const serverDoc = await txn.get(gameRef.collection('server').doc('state'));
    const serverState = serverDoc.data() as ServerState;

    const result = startGame(gameState, serverState, uid);

    txn.update(gameRef, result.gameState as Record<string, unknown>);
    txn.set(gameRef.collection('server').doc('state'), result.serverState);

    for (const pid of result.gameState.players) {
      txn.set(gameRef.collection('hands').doc(pid), {
        cards: result.serverState.hands[pid],
      });
    }
  });

  return { success: true };
});

export const playCardFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const req = request.data as PlayCardRequest;
  const gameRef = db.collection('games').doc(req.gameId);
  let events: unknown[] = [];

  await db.runTransaction(async (txn) => {
    const gameDoc = await txn.get(gameRef);
    if (!gameDoc.exists) throw new HttpsError('not-found', 'Game not found');

    let gameState = gameDoc.data() as GameState;
    const serverDoc = await txn.get(gameRef.collection('server').doc('state'));
    let serverState = serverDoc.data() as ServerState;

    // Draw phase
    const drawResult = drawCard(gameState, serverState, uid);
    gameState = drawResult.gameState;
    serverState = drawResult.serverState;

    // Play phase
    const result = playCard(gameState, serverState, uid, req);
    events = result.events;

    txn.update(gameRef, result.gameState as Record<string, unknown>);
    txn.set(gameRef.collection('server').doc('state'), result.serverState);

    // Update hands for all players (some may have changed due to peek/draw)
    for (const pid of result.gameState.players) {
      txn.set(gameRef.collection('hands').doc(pid), {
        cards: result.serverState.hands[pid],
      });
    }
  });

  return { events };
});

export const playTantrumFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const req = request.data as TantrumRequest;
  const gameRef = db.collection('games').doc(req.gameId);
  let events: unknown[] = [];

  await db.runTransaction(async (txn) => {
    const gameDoc = await txn.get(gameRef);
    if (!gameDoc.exists) throw new HttpsError('not-found', 'Game not found');

    const gameState = gameDoc.data() as GameState;
    const serverDoc = await txn.get(gameRef.collection('server').doc('state'));
    const serverState = serverDoc.data() as ServerState;

    const result = playTantrum(gameState, serverState, uid, req);
    events = result.events;

    txn.update(gameRef, result.gameState as Record<string, unknown>);
    txn.set(gameRef.collection('server').doc('state'), result.serverState);

    for (const pid of result.gameState.players) {
      txn.set(gameRef.collection('hands').doc(pid), {
        cards: result.serverState.hands[pid],
      });
    }
  });

  return { events };
});

export const startNextRoundFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data as { gameId: string };
  const gameRef = db.collection('games').doc(gameId);

  await db.runTransaction(async (txn) => {
    const gameDoc = await txn.get(gameRef);
    if (!gameDoc.exists) throw new HttpsError('not-found', 'Game not found');

    const gameState = gameDoc.data() as GameState;
    if (gameState.status !== GameStatus.RoundEnd) {
      throw new HttpsError('failed-precondition', 'Round is not over');
    }

    const serverDoc = await txn.get(gameRef.collection('server').doc('state'));
    const serverState = serverDoc.data() as ServerState;

    const result = resetRound(gameState, serverState);

    txn.update(gameRef, result.gameState as Record<string, unknown>);
    txn.set(gameRef.collection('server').doc('state'), result.serverState);

    for (const pid of result.gameState.players) {
      txn.set(gameRef.collection('hands').doc(pid), {
        cards: result.serverState.hands[pid],
      });
    }
  });

  return { success: true };
});
```

- [ ] **Step 3: Verify build**

Run: `cd firebase/functions && npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 4: Commit**

```bash
git add firebase/functions/src/index.ts firebase/functions/src/notifications.ts
git commit -m "feat: add Cloud Function endpoints and push notification helpers"
```

---

### Task 7: Firestore Security Rules

**Files:**
- Create: `firebase/firestore.rules`

- [ ] **Step 1: Write Firestore security rules**

```
// firebase/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: read any profile, write only your own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId;
      allow delete: if false;
    }

    // Games: players can read their own game. All writes via Cloud Functions.
    match /games/{gameId} {
      allow read: if request.auth != null
                  && request.auth.uid in resource.data.players;
      allow write: if false;
    }

    // Hands: each player reads only their own hand
    match /games/{gameId}/hands/{playerId} {
      allow read: if request.auth.uid == playerId;
      allow write: if false;
    }

    // Server state: no client access at all
    match /games/{gameId}/server/{document} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firebase/firestore.rules
git commit -m "feat: add Firestore security rules — per-player hand privacy, server-only draw pile"
```

---

## Phase 2: iOS App Foundation

### Task 8: Xcode Project Setup + Firebase SDK

**Files:**
- Create: `ios/project.yml`
- Create: `ios/GetDecked/App/GetDeckedApp.swift`
- Create: `ios/GetDecked/App/AppDelegate.swift`
- Create: `ios/GetDecked/Info.plist`
- Create: `ios/GetDeckedStickers/Info.plist`

- [ ] **Step 1: Install XcodeGen if needed**

Run: `which xcodegen || brew install xcodegen`

- [ ] **Step 2: Create XcodeGen project definition**

```yaml
# ios/project.yml
name: GetDecked
options:
  bundleIdPrefix: com.splendidbit
  deploymentTarget:
    iOS: "17.0"
  xcodeVersion: "16.0"
settings:
  base:
    SWIFT_VERSION: "5.9"
    TARGETED_DEVICE_FAMILY: "1"
packages:
  firebase-ios-sdk:
    url: https://github.com/firebase/firebase-ios-sdk
    from: "11.0.0"
targets:
  GetDecked:
    type: application
    platform: iOS
    sources:
      - path: GetDecked
    dependencies:
      - package: firebase-ios-sdk
        product: FirebaseAuth
      - package: firebase-ios-sdk
        product: FirebaseFirestore
      - package: firebase-ios-sdk
        product: FirebaseFunctions
      - package: firebase-ios-sdk
        product: FirebaseMessaging
      - package: firebase-ios-sdk
        product: FirebaseAnalytics
    settings:
      base:
        INFOPLIST_FILE: GetDecked/Info.plist
        PRODUCT_BUNDLE_IDENTIFIER: com.splendidbit.getdecked
    entitlements:
      path: GetDecked/GetDecked.entitlements
      properties:
        com.apple.developer.applesignin:
          - Default
        aps-environment: development
  GetDeckedTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - path: GetDeckedTests
    dependencies:
      - target: GetDecked
  GetDeckedStickers:
    type: app-extension.messages-sticker-pack
    platform: iOS
    sources:
      - path: GetDeckedStickers
    settings:
      base:
        INFOPLIST_FILE: GetDeckedStickers/Info.plist
        PRODUCT_BUNDLE_IDENTIFIER: com.splendidbit.getdecked.stickers
```

- [ ] **Step 3: Create app entry point with Firebase init**

```swift
// ios/GetDecked/App/GetDeckedApp.swift
import SwiftUI
import FirebaseCore

@main
struct GetDeckedApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(AuthService.shared)
        }
    }
}
```

```swift
// ios/GetDecked/App/AppDelegate.swift
import UIKit
import FirebaseCore
import FirebaseMessaging

class AppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
        application.registerForRemoteNotifications()

        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        // Store token in user's Firestore document
        Task {
            await AuthService.shared.updateFCMToken(token)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let gameId = userInfo["gameId"] as? String {
            DeepLinkHandler.shared.handleGameDeepLink(gameId: gameId)
        }
        completionHandler()
    }
}
```

- [ ] **Step 4: Create Info.plist files**

```xml
<!-- ios/GetDecked/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>getdecked</string>
            </array>
        </dict>
    </array>
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
    </array>
</dict>
</plist>
```

```xml
<!-- ios/GetDeckedStickers/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.message-payload-provider</string>
        <key>NSExtensionPrincipalClass</key>
        <string>StickerBrowserViewController</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 5: Generate Xcode project and verify build**

Run: `cd ios && xcodegen generate`
Expected: `GetDecked.xcodeproj` created.

Run: `cd ios && xcodebuild -scheme GetDecked -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `BUILD SUCCEEDED` (may need to add GoogleService-Info.plist first — create a placeholder for CI).

- [ ] **Step 6: Commit**

```bash
git add ios/
git commit -m "feat: initialize iOS project with XcodeGen, Firebase SDK, and push notification setup"
```

---

### Task 9: Swift Data Models

**Files:**
- Create: `ios/GetDecked/Models/Card.swift`
- Create: `ios/GetDecked/Models/GameState.swift`
- Create: `ios/GetDecked/Models/Player.swift`
- Create: `ios/GetDeckedTests/CardTests.swift`
- Create: `ios/GetDeckedTests/GameStateTests.swift`

- [ ] **Step 1: Define Card model matching server types**

```swift
// ios/GetDecked/Models/Card.swift
import Foundation

enum CardType: String, Codable, CaseIterable {
    case stress
    case chill
    case zen
    case dump
    case shield
    case deflect
    case snap
    case chainReaction
    case swap
    case peek
}

struct Card: Identifiable, Codable, Equatable {
    let id: String
    let type: CardType
    let name: String
    let description: String
    let value: Int

    var isStress: Bool { type == .stress }
    var isChill: Bool { type == .chill }
    var isSpecial: Bool { !isStress && !isChill }
    var requiresTarget: Bool {
        [.stress, .dump, .chainReaction, .swap, .peek].contains(type)
    }
    var requiresRedirectTarget: Bool { type == .deflect }
    var requiresSplashTarget: Bool { type == .chainReaction }
    var requiresFollowUp: Bool { type == .snap }

    var stressColor: String {
        switch type {
        case .stress: return "red"
        case .chill: return "blue"
        case .zen: return "cyan"
        case .dump: return "orange"
        case .shield: return "gray"
        case .deflect: return "purple"
        case .snap: return "yellow"
        case .chainReaction: return "pink"
        case .swap: return "green"
        case .peek: return "indigo"
        }
    }
}
```

- [ ] **Step 2: Define GameState and supporting types**

```swift
// ios/GetDecked/Models/GameState.swift
import Foundation

enum GameStatus: String, Codable {
    case waiting
    case active
    case meltdownPending
    case roundEnd
    case gameEnd
}

enum GameMode: String, Codable {
    case sync
    case async
}

struct ActiveEffect: Codable, Equatable {
    let type: String // "shield" or "deflect"
    let redirectTargetId: String?
    let expiresAfterTurnOf: String
}

struct TurnLogEntry: Codable, Identifiable {
    var id: String { "\(playerId)_\(cardName)_\(description.hashValue)" }
    let playerId: String
    let cardName: String
    let cardType: CardType
    let targetId: String?
    let stressChange: Int?
    let description: String
}

struct GameState: Codable, Identifiable {
    let id: String
    var players: [String]
    var playerNames: [String: String]
    var stressLevels: [String: Int]
    var currentTurnIndex: Int
    var round: Int
    var roundWins: [String: Int]
    var roundsToWin: Int
    var status: GameStatus
    var mode: GameMode
    var eliminatedPlayers: [String]
    var activeEffects: [String: [ActiveEffect]]
    var turnLog: [TurnLogEntry]
    var hostId: String
    var roomCode: String
    var isPressurePhase: Bool
    var turnDeadline: Double?
    var meltdownPlayerId: String?
    var createdAt: Double
    var updatedAt: Double

    var currentPlayerId: String {
        players[currentTurnIndex]
    }

    var activePlayers: [String] {
        players.filter { !eliminatedPlayers.contains($0) }
    }

    func isEliminated(_ playerId: String) -> Bool {
        eliminatedPlayers.contains(playerId)
    }

    func stressFor(_ playerId: String) -> Int {
        stressLevels[playerId] ?? 0
    }

    func nameFor(_ playerId: String) -> String {
        playerNames[playerId] ?? "Unknown"
    }
}
```

```swift
// ios/GetDecked/Models/Player.swift
import Foundation

struct UserProfile: Codable {
    var displayName: String
    var avatarId: String
    var cardBackId: String
    var meltdownEffectId: String
    var stats: PlayerStats
    var coins: Int
    var ownedCosmetics: [String]
    var fcmToken: String?
}

struct PlayerStats: Codable {
    var gamesPlayed: Int
    var wins: Int
    var meltdownsCaused: Int
    var tantrums: Int

    static let empty = PlayerStats(gamesPlayed: 0, wins: 0, meltdownsCaused: 0, tantrums: 0)
}
```

- [ ] **Step 3: Write model tests**

```swift
// ios/GetDeckedTests/CardTests.swift
import XCTest
@testable import GetDecked

final class CardTests: XCTestCase {
    func testStressCardRequiresTarget() {
        let card = Card(id: "1", type: .stress, name: "Test", description: "", value: 2)
        XCTAssertTrue(card.requiresTarget)
        XCTAssertTrue(card.isStress)
        XCTAssertFalse(card.isSpecial)
    }

    func testChillDoesNotRequireTarget() {
        let card = Card(id: "2", type: .chill, name: "Test", description: "", value: 1)
        XCTAssertFalse(card.requiresTarget)
        XCTAssertTrue(card.isChill)
    }

    func testSnapRequiresFollowUp() {
        let card = Card(id: "3", type: .snap, name: "Test", description: "", value: 0)
        XCTAssertTrue(card.requiresFollowUp)
        XCTAssertTrue(card.isSpecial)
    }

    func testDeflectRequiresRedirectTarget() {
        let card = Card(id: "4", type: .deflect, name: "Test", description: "", value: 0)
        XCTAssertTrue(card.requiresRedirectTarget)
    }
}
```

```swift
// ios/GetDeckedTests/GameStateTests.swift
import XCTest
@testable import GetDecked

final class GameStateTests: XCTestCase {
    func testActivePlayersExcludesEliminated() {
        var state = GameState(
            id: "test", players: ["p1", "p2", "p3"],
            playerNames: ["p1": "A", "p2": "B", "p3": "C"],
            stressLevels: ["p1": 3, "p2": 3, "p3": 3],
            currentTurnIndex: 0, round: 1,
            roundWins: [:], roundsToWin: 3,
            status: .active, mode: .sync,
            eliminatedPlayers: ["p2"],
            activeEffects: [:], turnLog: [],
            hostId: "p1", roomCode: "ABCD",
            isPressurePhase: false, turnDeadline: nil,
            meltdownPlayerId: nil,
            createdAt: 0, updatedAt: 0
        )
        XCTAssertEqual(state.activePlayers, ["p1", "p3"])
        XCTAssertTrue(state.isEliminated("p2"))
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd ios && xcodebuild test -scheme GetDecked -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | grep -E '(Test Case|Tests|BUILD)'`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/GetDecked/Models/ ios/GetDeckedTests/
git commit -m "feat: add Swift data models matching Firestore types"
```

---

### Task 10: Auth Service + Home Screen

**Files:**
- Create: `ios/GetDecked/Services/AuthService.swift`
- Create: `ios/GetDecked/Views/HomeView.swift`
- Create: `ios/GetDecked/ViewModels/HomeViewModel.swift`
- Create: `ios/GetDecked/Helpers/DeepLinkHandler.swift`

- [ ] **Step 1: Implement AuthService**

```swift
// ios/GetDecked/Services/AuthService.swift
import Foundation
import FirebaseAuth
import FirebaseFirestore
import AuthenticationServices

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var userId: String?
    @Published var displayName: String = ""
    @Published var isSignedIn: Bool = false
    @Published var profile: UserProfile?

    private let db = Firestore.firestore()

    private init() {
        if let user = Auth.auth().currentUser {
            self.userId = user.uid
            self.isSignedIn = true
            Task { await loadProfile() }
        }
    }

    func signInAnonymously() async throws {
        let result = try await Auth.auth().signInAnonymously()
        self.userId = result.user.uid
        self.isSignedIn = true
        await createProfileIfNeeded()
    }

    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async throws {
        guard let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            throw NSError(domain: "auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid token"])
        }
        let oauthCredential = OAuthProvider.appleCredential(
            withIDToken: token,
            rawNonce: nil,
            fullName: credential.fullName
        )
        let result = try await Auth.auth().signIn(with: oauthCredential)
        self.userId = result.user.uid
        self.isSignedIn = true

        if let fullName = credential.fullName {
            let name = [fullName.givenName, fullName.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            if !name.isEmpty { self.displayName = name }
        }

        await createProfileIfNeeded()
    }

    func updateFCMToken(_ token: String) async {
        guard let uid = userId else { return }
        try? await db.collection("users").document(uid).updateData([
            "fcmToken": token
        ])
    }

    private func createProfileIfNeeded() async {
        guard let uid = userId else { return }
        let doc = db.collection("users").document(uid)
        let snapshot = try? await doc.getDocument()

        if snapshot?.exists != true {
            let newProfile = UserProfile(
                displayName: displayName.isEmpty ? "Player" : displayName,
                avatarId: "default",
                cardBackId: "default",
                meltdownEffectId: "default",
                stats: .empty,
                coins: 0,
                ownedCosmetics: ["default"],
                fcmToken: nil
            )
            try? await doc.setData(try Firestore.Encoder().encode(newProfile))
            self.profile = newProfile
        } else {
            await loadProfile()
        }
    }

    func loadProfile() async {
        guard let uid = userId else { return }
        let doc = try? await db.collection("users").document(uid).getDocument()
        self.profile = try? doc?.data(as: UserProfile.self)
        self.displayName = profile?.displayName ?? "Player"
    }

    func updateDisplayName(_ name: String) async {
        guard let uid = userId else { return }
        self.displayName = name
        try? await db.collection("users").document(uid).updateData([
            "displayName": name
        ])
    }
}
```

- [ ] **Step 2: Create DeepLinkHandler**

```swift
// ios/GetDecked/Helpers/DeepLinkHandler.swift
import Foundation

@MainActor
class DeepLinkHandler: ObservableObject {
    static let shared = DeepLinkHandler()

    @Published var pendingGameId: String?

    func handleGameDeepLink(gameId: String) {
        pendingGameId = gameId
    }

    func consumePendingGame() -> String? {
        let id = pendingGameId
        pendingGameId = nil
        return id
    }
}
```

- [ ] **Step 3: Create Home screen**

```swift
// ios/GetDecked/ViewModels/HomeViewModel.swift
import Foundation

@MainActor
class HomeViewModel: ObservableObject {
    @Published var showCreateGame = false
    @Published var showJoinGame = false
    @Published var joinRoomCode = ""
    @Published var selectedMode: GameMode = .sync
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var activeGameId: String?

    private let gameService = GameService.shared

    func createGame(displayName: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await gameService.createGame(mode: selectedMode, displayName: displayName)
            activeGameId = result.gameId
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func joinGame(displayName: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let gameId = try await gameService.joinGame(roomCode: joinRoomCode, displayName: displayName)
            activeGameId = gameId
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
```

```swift
// ios/GetDecked/Views/HomeView.swift
import SwiftUI
import AuthenticationServices

struct HomeView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = HomeViewModel()
    @StateObject private var deepLink = DeepLinkHandler.shared
    @State private var showNamePrompt = false
    @State private var nameInput = ""

    var body: some View {
        NavigationStack {
            if !auth.isSignedIn {
                signInView
            } else if auth.displayName == "Player" || auth.displayName.isEmpty {
                namePromptView
            } else {
                mainMenuView
            }
        }
        .onChange(of: deepLink.pendingGameId) { _, gameId in
            if let gameId {
                vm.activeGameId = gameId
            }
        }
    }

    private var signInView: some View {
        VStack(spacing: 24) {
            Text("GET DECKED")
                .font(.system(size: 48, weight: .black))
            Text("The Card Game That Melts Friendships")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Spacer()

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName]
            } onCompletion: { result in
                Task {
                    if case .success(let auth) = result,
                       let credential = auth.credential as? ASAuthorizationAppleIDCredential {
                        try? await self.auth.signInWithApple(credential: credential)
                    }
                }
            }
            .frame(height: 50)
            .padding(.horizontal, 40)

            Button("Play as Guest") {
                Task { try? await auth.signInAnonymously() }
            }
            .font(.headline)

            Spacer()
        }
        .padding()
    }

    private var namePromptView: some View {
        VStack(spacing: 20) {
            Text("What should we call you?")
                .font(.title2.bold())
            TextField("Your name", text: $nameInput)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 40)
            Button("Let's Go") {
                Task {
                    await auth.updateDisplayName(nameInput)
                }
            }
            .disabled(nameInput.trimmingCharacters(in: .whitespaces).isEmpty)
            .buttonStyle(.borderedProminent)
        }
    }

    private var mainMenuView: some View {
        VStack(spacing: 20) {
            Text("GET DECKED")
                .font(.system(size: 40, weight: .black))

            Text("Hey, \(auth.displayName)")
                .font(.headline)
                .foregroundStyle(.secondary)

            Spacer()

            Button("Create Game") { vm.showCreateGame = true }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

            Button("Join Game") { vm.showJoinGame = true }
                .buttonStyle(.bordered)
                .controlSize(.large)

            Spacer()

            if let error = vm.errorMessage {
                Text(error).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
        .sheet(isPresented: $vm.showCreateGame) {
            CreateGameSheet(vm: vm, displayName: auth.displayName)
        }
        .sheet(isPresented: $vm.showJoinGame) {
            JoinGameSheet(vm: vm, displayName: auth.displayName)
        }
        .navigationDestination(item: $vm.activeGameId) { gameId in
            LobbyView(gameId: gameId)
        }
    }
}

struct CreateGameSheet: View {
    @ObservedObject var vm: HomeViewModel
    let displayName: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("New Game").font(.title2.bold())

                Picker("Mode", selection: $vm.selectedMode) {
                    Text("Real-Time").tag(GameMode.sync)
                    Text("Async").tag(GameMode.async)
                }
                .pickerStyle(.segmented)

                Button("Create") {
                    Task {
                        await vm.createGame(displayName: displayName)
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isLoading)
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct JoinGameSheet: View {
    @ObservedObject var vm: HomeViewModel
    let displayName: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Join Game").font(.title2.bold())

                TextField("Room Code", text: $vm.joinRoomCode)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .frame(width: 160)
                    .font(.title.monospaced())
                    .multilineTextAlignment(.center)

                Button("Join") {
                    Task {
                        await vm.joinGame(displayName: displayName)
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.joinRoomCode.count != 4 || vm.isLoading)
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add ios/GetDecked/Services/AuthService.swift ios/GetDecked/Views/HomeView.swift \
        ios/GetDecked/ViewModels/HomeViewModel.swift ios/GetDecked/Helpers/DeepLinkHandler.swift
git commit -m "feat: add auth service, home screen with create/join game flow"
```

---

### Task 11: Game Service + Real-time Listeners

**Files:**
- Create: `ios/GetDecked/Services/GameService.swift`
- Create: `ios/GetDecked/ViewModels/LobbyViewModel.swift`
- Create: `ios/GetDecked/ViewModels/GameViewModel.swift`

- [ ] **Step 1: Implement GameService**

```swift
// ios/GetDecked/Services/GameService.swift
import Foundation
import FirebaseFirestore
import FirebaseFunctions

@MainActor
class GameService: ObservableObject {
    static let shared = GameService()

    private let db = Firestore.firestore()
    private let functions = Functions.functions()

    func createGame(mode: GameMode, displayName: String) async throws -> (gameId: String, roomCode: String) {
        let result = try await functions.httpsCallable("createGameFn").call([
            "mode": mode.rawValue,
            "displayName": displayName,
        ])
        let data = result.data as! [String: Any]
        return (data["gameId"] as! String, data["roomCode"] as! String)
    }

    func joinGame(roomCode: String, displayName: String) async throws -> String {
        let result = try await functions.httpsCallable("joinGameFn").call([
            "roomCode": roomCode,
            "displayName": displayName,
        ])
        let data = result.data as! [String: Any]
        return data["gameId"] as! String
    }

    func startGame(gameId: String) async throws {
        _ = try await functions.httpsCallable("startGameFn").call([
            "gameId": gameId,
        ])
    }

    func playCard(
        gameId: String,
        cardId: String,
        targetId: String? = nil,
        deflectRedirectTargetId: String? = nil,
        chainReactionSplashTargetId: String? = nil,
        snapFollowUp: [String: Any]? = nil
    ) async throws {
        var data: [String: Any] = ["gameId": gameId, "cardId": cardId]
        if let t = targetId { data["targetId"] = t }
        if let d = deflectRedirectTargetId { data["deflectRedirectTargetId"] = d }
        if let c = chainReactionSplashTargetId { data["chainReactionSplashTargetId"] = c }
        if let s = snapFollowUp { data["snapFollowUp"] = s }
        _ = try await functions.httpsCallable("playCardFn").call(data)
    }

    func playTantrum(gameId: String, cardId: String, targetId: String) async throws {
        _ = try await functions.httpsCallable("playTantrumFn").call([
            "gameId": gameId,
            "cardId": cardId,
            "targetId": targetId,
        ])
    }

    func startNextRound(gameId: String) async throws {
        _ = try await functions.httpsCallable("startNextRoundFn").call([
            "gameId": gameId,
        ])
    }

    func listenToGame(gameId: String, onChange: @escaping (GameState) -> Void) -> ListenerRegistration {
        return db.collection("games").document(gameId).addSnapshotListener { snapshot, error in
            guard let data = snapshot?.data() else { return }
            if let state = try? Firestore.Decoder().decode(GameState.self, from: data) {
                onChange(state)
            }
        }
    }

    func listenToHand(gameId: String, playerId: String, onChange: @escaping ([Card]) -> Void) -> ListenerRegistration {
        return db.collection("games").document(gameId)
            .collection("hands").document(playerId)
            .addSnapshotListener { snapshot, error in
                guard let data = snapshot?.data(),
                      let cards = try? Firestore.Decoder().decode([String: [Card]].self, from: data) else {
                    return
                }
                onChange(cards["cards"] ?? [])
            }
    }
}
```

- [ ] **Step 2: Create GameViewModel**

```swift
// ios/GetDecked/ViewModels/GameViewModel.swift
import Foundation
import FirebaseFirestore

@MainActor
class GameViewModel: ObservableObject {
    @Published var gameState: GameState?
    @Published var hand: [Card] = []
    @Published var selectedCard: Card?
    @Published var selectedTarget: String?
    @Published var deflectTarget: String?
    @Published var splashTarget: String?
    @Published var snapFollowUpCard: Card?
    @Published var snapFollowUpTarget: String?
    @Published var showMeltdownOverlay = false
    @Published var meltdownPlayerId: String?
    @Published var isPlayingCard = false
    @Published var errorMessage: String?
    @Published var peekedHand: [Card]?

    let gameId: String
    let myId: String
    private let service = GameService.shared
    private var gameListener: ListenerRegistration?
    private var handListener: ListenerRegistration?

    var isMyTurn: Bool {
        guard let gs = gameState else { return false }
        return gs.status == .active && gs.currentPlayerId == myId
    }

    var isMyTantrum: Bool {
        guard let gs = gameState else { return false }
        return gs.status == .meltdownPending && gs.meltdownPlayerId == myId
    }

    var opponents: [String] {
        guard let gs = gameState else { return [] }
        return gs.players.filter { $0 != myId }
    }

    var validTargets: [String] {
        guard let gs = gameState else { return [] }
        return gs.activePlayers.filter { $0 != myId }
    }

    init(gameId: String, myId: String) {
        self.gameId = gameId
        self.myId = myId
        startListening()
    }

    func startListening() {
        gameListener = service.listenToGame(gameId: gameId) { [weak self] state in
            self?.gameState = state

            if state.status == .meltdownPending {
                self?.showMeltdownOverlay = true
                self?.meltdownPlayerId = state.meltdownPlayerId
            } else {
                self?.showMeltdownOverlay = false
            }
        }

        handListener = service.listenToHand(gameId: gameId, playerId: myId) { [weak self] cards in
            self?.hand = cards
        }
    }

    func playSelectedCard() async {
        guard let card = selectedCard else { return }
        isPlayingCard = true
        errorMessage = nil

        do {
            var snapFollowUp: [String: Any]?
            if card.type == .snap, let followUp = snapFollowUpCard {
                var fu: [String: Any] = ["cardId": followUp.id]
                if let t = snapFollowUpTarget { fu["targetId"] = t }
                snapFollowUp = fu
            }

            try await service.playCard(
                gameId: gameId,
                cardId: card.id,
                targetId: selectedTarget,
                deflectRedirectTargetId: deflectTarget,
                chainReactionSplashTargetId: splashTarget,
                snapFollowUp: snapFollowUp
            )
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
        isPlayingCard = false
    }

    func playTantrum() async {
        guard let card = selectedCard, let target = selectedTarget else { return }
        isPlayingCard = true
        do {
            try await service.playTantrum(gameId: gameId, cardId: card.id, targetId: target)
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
        isPlayingCard = false
    }

    func startNextRound() async {
        try? await service.startNextRound(gameId: gameId)
    }

    func clearSelection() {
        selectedCard = nil
        selectedTarget = nil
        deflectTarget = nil
        splashTarget = nil
        snapFollowUpCard = nil
        snapFollowUpTarget = nil
    }

    deinit {
        gameListener?.remove()
        handListener?.remove()
    }
}
```

- [ ] **Step 3: Create LobbyViewModel**

```swift
// ios/GetDecked/ViewModels/LobbyViewModel.swift
import Foundation
import FirebaseFirestore

@MainActor
class LobbyViewModel: ObservableObject {
    @Published var gameState: GameState?
    @Published var isStarting = false
    @Published var navigateToGame = false

    let gameId: String
    private let service = GameService.shared
    private var listener: ListenerRegistration?

    init(gameId: String) {
        self.gameId = gameId
        listener = service.listenToGame(gameId: gameId) { [weak self] state in
            self?.gameState = state
            if state.status == .active || state.status == .meltdownPending {
                self?.navigateToGame = true
            }
        }
    }

    func startGame() async {
        isStarting = true
        try? await service.startGame(gameId: gameId)
        isStarting = false
    }

    deinit { listener?.remove() }
}
```

- [ ] **Step 4: Commit**

```bash
git add ios/GetDecked/Services/GameService.swift ios/GetDecked/ViewModels/
git commit -m "feat: add GameService with Firestore listeners, GameViewModel and LobbyViewModel"
```

---

## Phase 3: Game UI

### Task 12: Lobby + Invite Flow

**Files:**
- Create: `ios/GetDecked/Views/LobbyView.swift`
- Create: `ios/GetDecked/Helpers/ShareHelper.swift`

- [ ] **Step 1: Create LobbyView and ShareHelper**

```swift
// ios/GetDecked/Helpers/ShareHelper.swift
import UIKit

struct ShareHelper {
    static func shareGameInvite(roomCode: String, gameId: String) {
        let message = "Join my Get Decked game! Room code: \(roomCode)\n\ngetdecked://join/\(roomCode)"
        let av = UIActivityViewController(activityItems: [message], applicationActivities: nil)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            root.present(av, animated: true)
        }
    }

    static func shareGameResult(gameState: GameState, events: [String]) -> String {
        guard let winnerId = gameState.activePlayers.first else { return "" }
        let winnerName = gameState.nameFor(winnerId)
        let standings = gameState.players.map { pid in
            "\(gameState.nameFor(pid)): \(gameState.roundWins[pid] ?? 0) wins"
        }.joined(separator: ", ")
        return "Get Decked Round \(gameState.round): \(winnerName) wins! \(standings)"
    }
}
```

```swift
// ios/GetDecked/Views/LobbyView.swift
import SwiftUI

struct LobbyView: View {
    @StateObject private var vm: LobbyViewModel
    @EnvironmentObject var auth: AuthService

    init(gameId: String) {
        _vm = StateObject(wrappedValue: LobbyViewModel(gameId: gameId))
    }

    var body: some View {
        VStack(spacing: 24) {
            if let gs = vm.gameState {
                Text("LOBBY")
                    .font(.title.bold())

                // Room code
                VStack(spacing: 4) {
                    Text("Room Code")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(gs.roomCode)
                        .font(.system(size: 48, weight: .black, design: .monospaced))
                }

                Text(gs.mode == .sync ? "Real-Time" : "Async")
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(.secondary.opacity(0.2))
                    .clipShape(Capsule())

                // Player list
                VStack(spacing: 12) {
                    ForEach(gs.players, id: \.self) { pid in
                        HStack {
                            Image(systemName: "person.fill")
                            Text(gs.nameFor(pid))
                                .font(.headline)
                            Spacer()
                            if pid == gs.hostId {
                                Text("HOST")
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(.orange)
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())
                            }
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal)

                Text("\(gs.players.count)/4 players")
                    .foregroundStyle(.secondary)

                Spacer()

                // Share invite
                Button {
                    ShareHelper.shareGameInvite(roomCode: gs.roomCode, gameId: gs.id)
                } label: {
                    Label("Invite Friends", systemImage: "square.and.arrow.up")
                }

                // Start button (host only)
                if gs.hostId == auth.userId {
                    Button("Start Game") {
                        Task { await vm.startGame() }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(gs.players.count < 2 || vm.isStarting)
                } else {
                    Text("Waiting for host to start...")
                        .foregroundStyle(.secondary)
                }
            } else {
                ProgressView("Loading...")
            }
        }
        .padding()
        .navigationDestination(isPresented: $vm.navigateToGame) {
            if let gs = vm.gameState, let myId = auth.userId {
                GameBoardView(gameId: gs.id, myId: myId)
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/GetDecked/Views/LobbyView.swift ios/GetDecked/Helpers/ShareHelper.swift
git commit -m "feat: add lobby view with room code display, invite sharing, and start game"
```

---

### Task 13: Card + Stress Meter Components

**Files:**
- Create: `ios/GetDecked/Views/CardView.swift`
- Create: `ios/GetDecked/Views/StressMeterView.swift`
- Create: `ios/GetDecked/Views/PlayerStatusView.swift`

- [ ] **Step 1: Create card and stress meter UI components**

```swift
// ios/GetDecked/Views/CardView.swift
import SwiftUI

struct CardView: View {
    let card: Card
    var isSelected: Bool = false
    var isSmall: Bool = false

    private var width: CGFloat { isSmall ? 60 : 90 }
    private var height: CGFloat { isSmall ? 84 : 126 }

    var body: some View {
        VStack(spacing: 4) {
            // Value badge
            if card.isStress {
                Text("+\(card.value)")
                    .font(isSmall ? .caption.bold() : .title3.bold())
                    .foregroundStyle(.white)
            } else if card.isChill {
                Text("-\(card.value)")
                    .font(isSmall ? .caption.bold() : .title3.bold())
                    .foregroundStyle(.white)
            } else {
                Image(systemName: iconName)
                    .font(isSmall ? .caption : .title3)
                    .foregroundStyle(.white)
            }

            // Name
            Text(card.name)
                .font(.system(size: isSmall ? 7 : 9, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(width: width, height: height)
        .background(cardColor.gradient)
        .clipShape(RoundedRectangle(cornerRadius: isSmall ? 8 : 12))
        .overlay(
            RoundedRectangle(cornerRadius: isSmall ? 8 : 12)
                .stroke(isSelected ? .yellow : .clear, lineWidth: 3)
        )
        .shadow(color: isSelected ? .yellow.opacity(0.5) : .black.opacity(0.2), radius: isSelected ? 8 : 4)
    }

    private var cardColor: Color {
        switch card.type {
        case .stress: return .red
        case .chill: return .blue
        case .zen: return .cyan
        case .dump: return .orange
        case .shield: return .gray
        case .deflect: return .purple
        case .snap: return .yellow
        case .chainReaction: return .pink
        case .swap: return .green
        case .peek: return .indigo
        }
    }

    private var iconName: String {
        switch card.type {
        case .zen: return "sparkles"
        case .dump: return "arrow.right"
        case .shield: return "shield.fill"
        case .deflect: return "arrow.uturn.right"
        case .snap: return "bolt.fill"
        case .chainReaction: return "flame.fill"
        case .swap: return "arrow.left.arrow.right"
        case .peek: return "eye.fill"
        default: return "questionmark"
        }
    }
}
```

```swift
// ios/GetDecked/Views/StressMeterView.swift
import SwiftUI

struct StressMeterView: View {
    let stress: Int
    let maxStress: Int = 10
    var isCompact: Bool = false

    private var fillRatio: CGFloat { CGFloat(stress) / CGFloat(maxStress) }

    private var meterColor: Color {
        switch stress {
        case 0...3: return .green
        case 4...6: return .yellow
        case 7...8: return .orange
        default: return .red
        }
    }

    var body: some View {
        VStack(spacing: 2) {
            Text("\(stress)")
                .font(isCompact ? .caption.bold() : .title2.bold())
                .foregroundStyle(stress >= 8 ? .red : .primary)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.secondary.opacity(0.2))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(meterColor.gradient)
                        .frame(width: geo.size.width * fillRatio)
                        .animation(.spring(duration: 0.4), value: stress)
                }
            }
            .frame(height: isCompact ? 6 : 10)
        }
        .frame(width: isCompact ? 40 : 60)
    }
}
```

```swift
// ios/GetDecked/Views/PlayerStatusView.swift
import SwiftUI

struct PlayerStatusView: View {
    let playerId: String
    let gameState: GameState
    let isCurrentTurn: Bool
    var isCompact: Bool = false

    private var isEliminated: Bool { gameState.isEliminated(playerId) }
    private var stress: Int { gameState.stressFor(playerId) }
    private var name: String { gameState.nameFor(playerId) }
    private var hasShield: Bool {
        (gameState.activeEffects[playerId] ?? []).contains { $0.type == "shield" }
    }
    private var hasDeflect: Bool {
        (gameState.activeEffects[playerId] ?? []).contains { $0.type == "deflect" }
    }

    var body: some View {
        VStack(spacing: 4) {
            // Avatar placeholder
            ZStack {
                Circle()
                    .fill(isEliminated ? .gray : (isCurrentTurn ? .yellow : .secondary).opacity(0.3))
                    .frame(width: isCompact ? 36 : 48, height: isCompact ? 36 : 48)
                Text(String(name.prefix(1)).uppercased())
                    .font(isCompact ? .caption.bold() : .headline)
                    .foregroundStyle(isEliminated ? .secondary : .primary)

                if hasShield {
                    Image(systemName: "shield.fill")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                        .offset(x: isCompact ? 14 : 20, y: isCompact ? -14 : -20)
                }
                if hasDeflect {
                    Image(systemName: "arrow.uturn.right")
                        .font(.caption2)
                        .foregroundStyle(.purple)
                        .offset(x: isCompact ? -14 : -20, y: isCompact ? -14 : -20)
                }
            }

            Text(name)
                .font(isCompact ? .caption2 : .caption)
                .lineLimit(1)

            if !isEliminated {
                StressMeterView(stress: stress, isCompact: isCompact)
            } else {
                Text("OUT")
                    .font(.caption2.bold())
                    .foregroundStyle(.red)
            }
        }
        .opacity(isEliminated ? 0.5 : 1)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/GetDecked/Views/CardView.swift ios/GetDecked/Views/StressMeterView.swift \
        ios/GetDecked/Views/PlayerStatusView.swift
git commit -m "feat: add CardView, StressMeterView, and PlayerStatusView components"
```

---

### Task 14: Game Board + Hand View

**Files:**
- Create: `ios/GetDecked/Views/GameBoardView.swift`
- Create: `ios/GetDecked/Views/HandView.swift`

- [ ] **Step 1: Create the main game board and hand views**

```swift
// ios/GetDecked/Views/HandView.swift
import SwiftUI

struct HandView: View {
    let cards: [Card]
    @Binding var selectedCard: Card?
    var onCardTap: ((Card) -> Void)?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: -20) {
                ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                    CardView(card: card, isSelected: selectedCard?.id == card.id)
                        .zIndex(selectedCard?.id == card.id ? 10 : Double(index))
                        .offset(y: selectedCard?.id == card.id ? -20 : 0)
                        .animation(.spring(duration: 0.2), value: selectedCard?.id)
                        .onTapGesture {
                            if selectedCard?.id == card.id {
                                selectedCard = nil
                            } else {
                                selectedCard = card
                            }
                            onCardTap?(card)
                        }
                }
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 150)
    }
}
```

```swift
// ios/GetDecked/Views/GameBoardView.swift
import SwiftUI

struct GameBoardView: View {
    @StateObject private var vm: GameViewModel
    @EnvironmentObject var auth: AuthService

    init(gameId: String, myId: String) {
        _vm = StateObject(wrappedValue: GameViewModel(gameId: gameId, myId: myId))
    }

    var body: some View {
        ZStack {
            if let gs = vm.gameState {
                VStack(spacing: 0) {
                    // Opponents area (top)
                    opponentsBar(gs)
                        .padding(.top, 8)

                    Spacer()

                    // Turn log (center)
                    turnLogView(gs)

                    Spacer()

                    // Status bar
                    statusBar(gs)
                        .padding(.horizontal)

                    // My hand (bottom)
                    HandView(cards: vm.hand, selectedCard: $vm.selectedCard)

                    // Action bar
                    actionBar(gs)
                        .padding(.bottom, 8)
                }

                // Meltdown overlay
                if vm.showMeltdownOverlay, let mpId = vm.meltdownPlayerId {
                    MeltdownOverlay(
                        playerName: gs.nameFor(mpId),
                        isMyTantrum: vm.isMyTantrum,
                        hand: vm.isMyTantrum ? vm.hand : [],
                        validTargets: vm.validTargets.map { (id: $0, name: gs.nameFor($0)) },
                        selectedCard: $vm.selectedCard,
                        selectedTarget: $vm.selectedTarget,
                        onPlayTantrum: { Task { await vm.playTantrum() } }
                    )
                }

                // Round end
                if gs.status == .roundEnd || gs.status == .gameEnd {
                    GameEndView(gameState: gs, myId: vm.myId) {
                        Task { await vm.startNextRound() }
                    }
                }
            } else {
                ProgressView("Loading game...")
            }
        }
        .navigationBarBackButtonHidden(true)
        .alert("Error", isPresented: .init(
            get: { vm.errorMessage != nil },
            set: { if !$0 { vm.errorMessage = nil } }
        )) {
            Button("OK") { vm.errorMessage = nil }
        } message: {
            Text(vm.errorMessage ?? "")
        }
    }

    private func opponentsBar(_ gs: GameState) -> some View {
        HStack(spacing: 16) {
            ForEach(vm.opponents, id: \.self) { pid in
                PlayerStatusView(
                    playerId: pid,
                    gameState: gs,
                    isCurrentTurn: gs.currentPlayerId == pid,
                    isCompact: vm.opponents.count > 2
                )
                .onTapGesture {
                    if vm.selectedCard != nil && vm.validTargets.contains(pid) {
                        vm.selectedTarget = pid
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(vm.selectedTarget == pid ? .yellow : .clear, lineWidth: 2)
                )
            }
        }
        .padding(.horizontal)
    }

    private func turnLogView(_ gs: GameState) -> some View {
        VStack(spacing: 4) {
            ForEach(gs.turnLog.suffix(3)) { entry in
                Text(entry.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal)
    }

    private func statusBar(_ gs: GameState) -> some View {
        HStack {
            // My stress
            VStack(alignment: .leading, spacing: 2) {
                Text("Your Stress")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                StressMeterView(stress: gs.stressFor(vm.myId))
            }

            Spacer()

            // Round info
            VStack(spacing: 2) {
                Text("Round \(gs.round)")
                    .font(.caption.bold())
                if gs.isPressurePhase {
                    Text("PRESSURE")
                        .font(.caption2.bold())
                        .foregroundStyle(.red)
                }
            }

            Spacer()

            // Turn indicator
            if vm.isMyTurn {
                Text("YOUR TURN")
                    .font(.caption.bold())
                    .foregroundStyle(.green)
            } else {
                Text("\(gs.nameFor(gs.currentPlayerId))'s turn")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func actionBar(_ gs: GameState) -> some View {
        if vm.isMyTurn, let card = vm.selectedCard {
            HStack(spacing: 12) {
                Button("Cancel") { vm.clearSelection() }
                    .buttonStyle(.bordered)

                // Target selection for cards that need it
                if card.requiresTarget && vm.selectedTarget == nil {
                    Text("Tap an opponent")
                        .font(.caption)
                        .foregroundStyle(.orange)
                } else if card.requiresRedirectTarget && vm.deflectTarget == nil {
                    // Deflect: need a redirect target picker
                    Menu("Deflect to...") {
                        ForEach(vm.validTargets, id: \.self) { pid in
                            Button(gs.nameFor(pid)) { vm.deflectTarget = pid }
                        }
                    }
                } else {
                    Button("Play") {
                        Task { await vm.playSelectedCard() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isPlayingCard || (card.requiresTarget && vm.selectedTarget == nil))
                }
            }
            .padding(.horizontal)
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/GetDecked/Views/GameBoardView.swift ios/GetDecked/Views/HandView.swift
git commit -m "feat: add game board with opponent bar, hand view, turn log, and action bar"
```

---

### Task 15: Meltdown Overlay + Game End

**Files:**
- Create: `ios/GetDecked/Views/MeltdownOverlay.swift`
- Create: `ios/GetDecked/Views/GameEndView.swift`

- [ ] **Step 1: Create meltdown overlay and game end views**

```swift
// ios/GetDecked/Views/MeltdownOverlay.swift
import SwiftUI

struct MeltdownOverlay: View {
    let playerName: String
    let isMyTantrum: Bool
    let hand: [Card]
    let validTargets: [(id: String, name: String)]
    @Binding var selectedCard: Card?
    @Binding var selectedTarget: String?
    let onPlayTantrum: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()

            VStack(spacing: 20) {
                Text("MELTDOWN!")
                    .font(.system(size: 44, weight: .black))
                    .foregroundStyle(.red)

                Text("\(playerName) hit stress 10!")
                    .font(.title3)
                    .foregroundStyle(.white)

                if isMyTantrum {
                    Text("Choose a card for your tantrum")
                        .font(.headline)
                        .foregroundStyle(.orange)

                    // Card selection
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(hand) { card in
                                CardView(card: card, isSelected: selectedCard?.id == card.id, isSmall: true)
                                    .onTapGesture { selectedCard = card }
                            }
                        }
                        .padding(.horizontal)
                    }

                    if selectedCard != nil {
                        Text("Pick your target:")
                            .font(.subheadline)
                            .foregroundStyle(.white)

                        HStack(spacing: 12) {
                            ForEach(validTargets, id: \.id) { target in
                                Button(target.name) {
                                    selectedTarget = target.id
                                }
                                .buttonStyle(.bordered)
                                .tint(selectedTarget == target.id ? .red : .white)
                            }
                        }
                    }

                    if selectedCard != nil && selectedTarget != nil {
                        let damage = selectedCard!.type == .stress ? selectedCard!.value * 2 : 3
                        Text("Tantrum damage: \(damage)")
                            .font(.headline)
                            .foregroundStyle(.orange)

                        Button("TANTRUM!") { onPlayTantrum() }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                            .controlSize(.large)
                    }
                } else {
                    Text("Waiting for \(playerName)'s tantrum...")
                        .foregroundStyle(.white.opacity(0.7))
                    ProgressView()
                        .tint(.white)
                }
            }
            .padding()
        }
    }
}
```

```swift
// ios/GetDecked/Views/GameEndView.swift
import SwiftUI

struct GameEndView: View {
    let gameState: GameState
    let myId: String
    let onNextRound: () -> Void

    private var winnerId: String? { gameState.activePlayers.first }
    private var isGameOver: Bool { gameState.status == .gameEnd }

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()

            VStack(spacing: 20) {
                if isGameOver {
                    Text("GAME OVER")
                        .font(.system(size: 40, weight: .black))
                        .foregroundStyle(.yellow)
                } else {
                    Text("ROUND \(gameState.round) OVER")
                        .font(.system(size: 32, weight: .black))
                        .foregroundStyle(.yellow)
                }

                if let wid = winnerId {
                    Text("\(gameState.nameFor(wid)) wins!")
                        .font(.title)
                        .foregroundStyle(.white)
                }

                // Scoreboard
                VStack(spacing: 8) {
                    ForEach(gameState.players, id: \.self) { pid in
                        HStack {
                            Text(gameState.nameFor(pid))
                                .foregroundStyle(.white)
                            Spacer()
                            Text("\(gameState.roundWins[pid] ?? 0) / \(gameState.roundsToWin)")
                                .font(.headline)
                                .foregroundStyle(pid == winnerId ? .yellow : .white.opacity(0.7))
                        }
                        .padding(.horizontal, 40)
                    }
                }

                if isGameOver {
                    Button("Rematch") { onNextRound() }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)

                    Button("Share Result") {
                        let message = ShareHelper.shareGameResult(gameState: gameState, events: [])
                        let av = UIActivityViewController(activityItems: [message], applicationActivities: nil)
                        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                           let root = scene.windows.first?.rootViewController {
                            root.present(av, animated: true)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                } else {
                    Button("Next Round") { onNextRound() }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                }
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/GetDecked/Views/MeltdownOverlay.swift ios/GetDecked/Views/GameEndView.swift
git commit -m "feat: add meltdown overlay with tantrum selection and game end scoreboard"
```

---

## Phase 4: Multiplayer + Polish

### Task 16: Push Notification Service

**Files:**
- Create: `ios/GetDecked/Services/NotificationService.swift`

- [ ] **Step 1: Create NotificationService for handling incoming pushes**

```swift
// ios/GetDecked/Services/NotificationService.swift
import Foundation
import UserNotifications

class NotificationService {
    static func handleNotification(_ userInfo: [AnyHashable: Any]) {
        guard let gameId = userInfo["gameId"] as? String else { return }

        Task { @MainActor in
            DeepLinkHandler.shared.handleGameDeepLink(gameId: gameId)
        }
    }

    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            return try await center.requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            return false
        }
    }
}
```

- [ ] **Step 2: Add FCM notification sending to Cloud Functions index.ts**

Add to the bottom of `firebase/functions/src/index.ts`, after the existing functions:

```typescript
// Add to firebase/functions/src/index.ts — after playCardFn

// Send push notification after turn advances (called internally, not exposed)
async function sendTurnNotification(gameId: string, gameState: GameState, events: GameEvent[]) {
  if (gameState.mode !== GameMode.Async) return;
  if (gameState.status === GameStatus.GameEnd || gameState.status === GameStatus.RoundEnd) return;

  const targetPlayerId = gameState.status === GameStatus.MeltdownPending
    ? gameState.meltdownPlayerId
    : gameState.players[gameState.currentTurnIndex];

  if (!targetPlayerId) return;

  const userDoc = await db.collection('users').doc(targetPlayerId).get();
  const fcmToken = userDoc.data()?.fcmToken;
  if (!fcmToken) return;

  const notification = gameState.status === GameStatus.MeltdownPending
    ? composeMeltdownNotification(gameState, targetPlayerId)
    : composeTurnNotification(gameState, targetPlayerId, events[events.length - 1]);

  try {
    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: { gameId },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}
```

Then call `sendTurnNotification` at the end of `playCardFn` and `playTantrumFn` (after the transaction completes). Add these lines right before `return { events }`:

```typescript
// At end of playCardFn, after transaction:
await sendTurnNotification(req.gameId, /* pass latest gameState */, events as GameEvent[]);

// At end of playTantrumFn, after transaction:
await sendTurnNotification(req.gameId, /* pass latest gameState */, events as GameEvent[]);
```

**Note:** To access the post-transaction game state, read it after the transaction:

```typescript
const finalDoc = await gameRef.get();
const finalState = finalDoc.data() as GameState;
await sendTurnNotification(req.gameId, finalState, events as GameEvent[]);
```

- [ ] **Step 3: Commit**

```bash
git add ios/GetDecked/Services/NotificationService.swift firebase/functions/src/index.ts
git commit -m "feat: add push notification sending in Cloud Functions and iOS notification handler"
```

---

### Task 17: Tutorial

**Files:**
- Create: `ios/GetDecked/Views/TutorialView.swift`

- [ ] **Step 1: Create interactive tutorial**

```swift
// ios/GetDecked/Views/TutorialView.swift
import SwiftUI

struct TutorialView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0

    private let steps: [(title: String, body: String, highlight: String)] = [
        (
            "Welcome to Get Decked!",
            "Push your friends' stress to 10 — when someone melts down, they get one explosive tantrum for revenge. Last player calm wins!",
            "stress"
        ),
        (
            "Your Turn",
            "Draw 1 card, then play 1 card. Red stress cards attack opponents. Blue chill cards reduce your own stress.",
            "cards"
        ),
        (
            "Special Cards",
            "Shield blocks the next attack. Deflect redirects it. Dump transfers your stress to someone else. Snap lets you play two cards!",
            "specials"
        ),
        (
            "The Meltdown",
            "Hit stress 10 and you MELT DOWN — you're eliminated from the round. But you get a Meltdown Tantrum: one last card at double power!",
            "meltdown"
        ),
        (
            "The Zen Card",
            "Only 2 in the deck. Resets your stress to 0. The ultimate comeback card. Use it wisely.",
            "zen"
        ),
        (
            "Winning",
            "Last player standing wins the round. Win best of 3 rounds to win the game. That's it — go melt some friendships!",
            "win"
        ),
    ]

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text(steps[step].title)
                .font(.title.bold())
                .multilineTextAlignment(.center)

            Text(steps[step].body)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)

            // Progress dots
            HStack(spacing: 8) {
                ForEach(0..<steps.count, id: \.self) { i in
                    Circle()
                        .fill(i == step ? Color.primary : Color.secondary.opacity(0.3))
                        .frame(width: 8, height: 8)
                }
            }

            Spacer()

            HStack {
                if step > 0 {
                    Button("Back") { withAnimation { step -= 1 } }
                        .buttonStyle(.bordered)
                }
                Spacer()
                if step < steps.count - 1 {
                    Button("Next") { withAnimation { step += 1 } }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button("Let's Play!") { dismiss() }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(.horizontal, 32)
            .padding(.bottom)
        }
        .padding()
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/GetDecked/Views/TutorialView.swift
git commit -m "feat: add step-through tutorial explaining game rules"
```

---

### Task 18: Stats View + iMessage Stickers + Deep Links

**Files:**
- Create: `ios/GetDecked/Views/StatsView.swift`
- Create: `ios/GetDeckedStickers/Stickers.xcstickers/` (sticker assets directory)

- [ ] **Step 1: Create StatsView**

```swift
// ios/GetDecked/Views/StatsView.swift
import SwiftUI

struct StatsView: View {
    @EnvironmentObject var auth: AuthService

    private var stats: PlayerStats { auth.profile?.stats ?? .empty }

    var body: some View {
        List {
            Section("Your Stats") {
                StatRow(label: "Games Played", value: "\(stats.gamesPlayed)")
                StatRow(label: "Wins", value: "\(stats.wins)")
                StatRow(label: "Win Rate", value: stats.gamesPlayed > 0
                    ? "\(Int(Double(stats.wins) / Double(stats.gamesPlayed) * 100))%"
                    : "—")
                StatRow(label: "Meltdowns Caused", value: "\(stats.meltdownsCaused)")
                StatRow(label: "Tantrums Thrown", value: "\(stats.tantrums)")
            }
        }
        .navigationTitle("Stats")
    }
}

struct StatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
    }
}
```

- [ ] **Step 2: Set up iMessage sticker pack structure**

Create the sticker asset catalog directory structure. Sticker images (PNG, 300x300px) will be added by the designer. For now, create the catalog structure:

Run:
```bash
mkdir -p ios/GetDeckedStickers/Stickers.xcstickers/Sticker\ Pack.stickerpack
```

Create an empty `Contents.json` for the sticker pack:

```json
// ios/GetDeckedStickers/Stickers.xcstickers/Contents.json
{
  "info": { "version": 1, "author": "xcode" }
}
```

```json
// ios/GetDeckedStickers/Stickers.xcstickers/Sticker Pack.stickerpack/Contents.json
{
  "info": { "version": 1, "author": "xcode" },
  "properties": { "grid-size": "regular" }
}
```

Placeholder stickers will be added when artwork is ready. The sticker pack extension is already configured in `project.yml`.

- [ ] **Step 3: Add deep link handling to GetDeckedApp**

Update `ios/GetDecked/App/GetDeckedApp.swift` to add URL handling:

```swift
// Replace the entire GetDeckedApp.swift with:
import SwiftUI
import FirebaseCore

@main
struct GetDeckedApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(AuthService.shared)
                .onOpenURL { url in
                    // Handle getdecked://join/ABCD deep links
                    if url.scheme == "getdecked",
                       url.host == "join",
                       let roomCode = url.pathComponents.last, roomCode.count == 4 {
                        // Store room code for the home screen to pick up
                        DeepLinkHandler.shared.handleGameDeepLink(gameId: roomCode)
                    }
                }
        }
    }
}
```

- [ ] **Step 4: Add stats update logic to Cloud Functions**

Add this to `firebase/functions/src/index.ts` — a helper to update player stats after a game event:

```typescript
async function updatePlayerStats(
  playerId: string,
  updates: { gamesPlayed?: number; wins?: number; meltdownsCaused?: number; tantrums?: number },
) {
  const userRef = db.collection('users').doc(playerId);
  const increments: Record<string, FirebaseFirestore.FieldValue> = {};
  if (updates.gamesPlayed) increments['stats.gamesPlayed'] = FieldValue.increment(updates.gamesPlayed);
  if (updates.wins) increments['stats.wins'] = FieldValue.increment(updates.wins);
  if (updates.meltdownsCaused) increments['stats.meltdownsCaused'] = FieldValue.increment(updates.meltdownsCaused);
  if (updates.tantrums) increments['stats.tantrums'] = FieldValue.increment(updates.tantrums);
  await userRef.update(increments);
}
```

Call `updatePlayerStats` at game end (in `playTantrumFn` when status becomes `GameEnd` or `RoundEnd` on the final round) to increment wins and gamesPlayed for all participants.

- [ ] **Step 5: Commit**

```bash
git add ios/GetDecked/Views/StatsView.swift ios/GetDeckedStickers/ \
        ios/GetDecked/App/GetDeckedApp.swift firebase/functions/src/index.ts
git commit -m "feat: add stats view, sticker pack skeleton, deep link handling, and stat tracking"
```

---

### Task 19: Final Integration + Build Verification

**Files:**
- Modify: `ios/GetDecked/Views/HomeView.swift` (add tutorial + stats navigation)

- [ ] **Step 1: Add tutorial and stats to home screen**

Add these navigation destinations to the `mainMenuView` in `HomeView.swift`, after the "Join Game" button and before the Spacer:

```swift
NavigationLink("How to Play") {
    TutorialView()
}
.buttonStyle(.bordered)

NavigationLink("Stats") {
    StatsView()
}
.buttonStyle(.bordered)
```

- [ ] **Step 2: Build and verify Cloud Functions**

Run: `cd firebase/functions && npm run build && npm test`
Expected: Build succeeds, all tests pass.

- [ ] **Step 3: Build and verify iOS project**

Run: `cd ios && xcodegen generate && xcodebuild -scheme GetDecked -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: Commit**

```bash
git add ios/GetDecked/Views/HomeView.swift
git commit -m "feat: wire up tutorial and stats in home screen, verify full build"
```

---

### Task 20: Firebase Deployment Setup

**Files:**
- Create: `.firebaserc`

- [ ] **Step 1: Create Firebase project configuration**

```json
// firebase/.firebaserc
{
  "projects": {
    "default": "get-decked"
  }
}
```

- [ ] **Step 2: Verify emulator setup works**

Run: `cd firebase && firebase emulators:start --only functions,firestore 2>&1 | head -20`
Expected: Emulators start successfully (requires `firebase-tools` installed globally: `npm install -g firebase-tools`).

- [ ] **Step 3: Commit**

```bash
git add firebase/.firebaserc
git commit -m "feat: add Firebase project configuration for deployment"
```

---

## Post-Implementation Notes

### Testing Strategy
- **Game engine**: Covered by Jest tests (Tasks 2-5). Add edge case tests during balance tuning.
- **Cloud Functions**: Test via Firebase Emulator Suite locally before deploying.
- **iOS UI**: Manual testing via Simulator and TestFlight. No UI unit tests for MVP.
- **Multiplayer**: Test with 2 Simulator instances + 1 physical device via TestFlight.

### Deployment Checklist
1. Create Firebase project at console.firebase.google.com
2. Enable Authentication (Apple, Anonymous)
3. Create Firestore database
4. Download `GoogleService-Info.plist` → `ios/GetDecked/`
5. Deploy Cloud Functions: `cd firebase && firebase deploy --only functions`
6. Deploy Firestore rules: `cd firebase && firebase deploy --only firestore:rules`
7. Configure APNs key in Firebase Console → Cloud Messaging
8. Archive iOS app → TestFlight

### Balance Tuning (Post-Launch)
All card values are tunable via Firebase Remote Config without app updates:
- Starting stress (default: 3)
- Stress card values (+1/+2/+3/+4)
- Chill card values (-1/-2/-3)
- Dump transfer amount (default: 2)
- Chain Reaction splash damage (default: 2)
- Tantrum multiplier for stress cards (default: 2x)
- Tantrum flat damage for non-stress cards (default: 3)
- Pressure phase stress per cycle (default: +1)
