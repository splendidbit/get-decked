# Get Decked: Meltdown — Game Design Specification

## Overview

**One sentence**: Push your friends' stress to 10 with absurd cards — when someone melts down, they get one explosive tantrum for revenge.

**Genre**: Multiplayer mobile card game (casual/social)
**Players**: 2–5 (MVP: 2–4)
**Platform**: iOS-first (Swift/SwiftUI), Android v2.0
**Modes**: Real-time synchronous, asynchronous with iMessage integration
**Tone**: Absurdist/chaotic — weird creatures, ridiculous effects, hilarious escalation
**Comparable titles**: UNO (accessibility), Exploding Kittens (tone), but mechanically distinct from both

---

## Core Concept

Each player has a visible stress meter (0–10). You play cards to stress opponents or calm yourself down. Hit 10 = you **Melt Down** and are eliminated from the round — but you get a **Meltdown Tantrum**, one final boosted card play as revenge. Last player calm wins.

Cards are absurd stressors: "Existential Pudding," "Surprise Audit by Ghosts," "Spa Day with Bees."

The stress meter is the defining innovation. Unlike Exploding Kittens (sudden surprise elimination) or UNO (race to empty hand), Meltdown creates **visible, building tension**. Everyone can see the meters climbing. Targeting decisions create politics, alliances, and betrayals every turn.

---

## Rules

### Setup

- Shuffle the 80-card deck
- Deal 5 cards to each player
- All players start at **stress 3**
- Stress is always clamped to the range **0–10** (Chill cards cannot reduce below 0)
- Remaining cards form the draw pile
- Random player goes first

### Turn Structure

1. **Draw** 1 card from the draw pile
2. **Play** 1 card from your hand:
   - Play a **Stress** card on any opponent (adds to their stress meter)
   - Play a **Chill** card on yourself (reduces your stress)
   - Play a **Special** card (various effects)
3. Resolve any triggered effects (Shields absorb, Deflects redirect)
4. Check for Meltdowns

### Meltdown

When a player reaches **10 or more stress**, they Melt Down:

- They are **eliminated** from the round
- They play their **Meltdown Tantrum**: choose 1 card from their remaining hand and discard it
  - If it's a **Stress card**: deal **double** its value to any remaining player
  - If it's **any other card**: deal **3 stress** to any remaining player
- If the Tantrum triggers another Meltdown, that player also gets a Tantrum (chain meltdowns)

### Winning

- Last player standing wins the round
- Play **best of 3 rounds** (best of 5 for 2-player)
- Between rounds: reshuffle entire deck, redeal 5, stress resets to 3

### Pressure Phase

If the draw pile runs out:

- Shuffle the discard pile into a new draw pile
- From now on: **all players gain +1 stress** at the start of each full turn cycle
- Guarantees the game converges — no stalling

### 2-Player Variant

Same rules, best of 5 rounds. The duel format is inherently swingy, so more rounds average out luck.

---

## Deck Design (80 Cards)

### Stress Cards — 34 total

Play on any opponent to increase their stress.

| Card       | Value | Count | Example Names                                                                    |
| ---------- | ----- | ----- | -------------------------------------------------------------------------------- |
| +1 Stress  | +1    | 14    | "Judgmental Pigeon," "Slightly Haunted Sock," "Aggressive Breeze"                |
| +2 Stress  | +2    | 10    | "Existential Pudding," "Sentient Traffic Jam," "Unsolicited Advice Tornado"      |
| +3 Stress  | +3    | 6     | "Surprise Ghost Audit," "Angry Volcano Invitation," "Tax Return That Bites"      |
| +4 Stress  | +4    | 4     | "Full Moon of Bureaucracy," "The Pudding Strikes Back"                           |

### Chill Cards — 18 total

Play on yourself to reduce your stress.

| Card      | Value | Count | Example Names                                          |
| --------- | ----- | ----- | ------------------------------------------------------ |
| -1 Chill  | -1    | 8     | "Complimentary Nap," "Friendly Void," "Lukewarm Approval" |
| -2 Chill  | -2    | 6     | "Spa Day (No Bees)," "Suspiciously Calm River"         |
| -3 Chill  | -3    | 4     | "Perfect Burrito," "Cloud That Believes in You"        |

### Special Cards — 28 total

| Card               | Count | Effect                                                                                                                                         |
| ------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zen**            | 2     | Reset your stress to **0**. The comeback card.                                                                                                 |
| **Dump**           | 6     | Transfer 2 stress from yourself to any opponent. (You: -2, them: +2)                                                                           |
| **Shield**         | 4     | Play on your turn. The next Stress card targeting you is **nullified**. Lasts until triggered or your next turn.                                |
| **Deflect**        | 4     | Play on your turn, name a target. Next Stress card targeting you **redirects** to that player instead. Lasts until triggered or your next turn. |
| **Snap**           | 4     | Play this AND immediately play another card from your hand. Double-action turn.                                                                |
| **Chain Reaction** | 4     | Deal +2 stress to target. If they Melt Down this turn, splash +2 stress to another player of your choice.                                      |
| **Swap**           | 2     | Trade stress levels with any opponent.                                                                                                         |
| **Peek**           | 2     | Look at any opponent's entire hand. Then draw 1 extra card.                                                                                    |

### Deck Math

- Total stress injected by cards: ~68 (Stress cards) + 16 (Chain Reactions) = **84**
- Total stress removed by cards: ~32 (Chill) + up to 20 (Zen) = **~52**
- Net stress into the system: **~32** (plus starting stress)
- With 4 players at stress 3: starting total = 12, need ~21 net stress to eliminate 3
- **The game converges before the deck runs out.** Pressure Phase is the failsafe.
- Exact values require playtesting; Firebase Remote Config allows live tuning.

---

## Special Mechanics

### The Meltdown Tantrum

The game's signature mechanic. When you go down, you go down swinging. Serves three purposes:

1. **Deterrence** — pushing someone to 10 costs you ~3-8 stress back
2. **Narrative** — creates "remember when..." stories
3. **Agency** — eliminated players have a meaningful final choice

### Chain Meltdowns

If a Tantrum pushes another player to 10, they also Melt Down and get their own Tantrum. A single meltdown can theoretically cascade through the entire table. Rare, but the stuff of legends when it happens.

### Shield & Deflect (Async-Friendly Reactions)

Critical design decision: **all decisions happen on YOUR turn.** No out-of-turn reactions. Shield and Deflect are played proactively and resolve automatically. This makes async mode possible without reaction windows.

### The Swap Card

The great equalizer. At stress 8, swap with the player at 2. Dramatic reversal. Everyone saw you do it — and the swapped player is coming for you.

### The Zen Card

Only 2 in the deck. Going from stress 9 to stress 0 is the single most dramatic moment in the game. The "UNO reversal" — an instant classic clip moment.

---

## Synchronous Mode Design

**For**: Game night, couch play, voice calls with friends.

- **Lobby**: Host creates game, shares 4-character room code or invite link
- **Turn timer**: 15 seconds (configurable: 10s, 15s, 30s, no limit)
- **Timeout**: Auto-draw and auto-play lowest stress card on random opponent
- **Round flow**: 5–7 minutes per round. Full best-of-3: ~15–20 minutes
- **Animations**: Card play, stress meter filling, meltdown explosion + tantrum effect
- **Sound**: Heartbeat as stress approaches 10. Meltdown siren. Zen "ahhhh" choir
- **Between rounds**: 10-second break with scoreboard

**UX priority**: Feel like a party game on your phone. Fast, loud, reactive.

---

## Asynchronous Mode Design

**For**: Group chats, playing throughout the day, different time zones.

- **No turn timer** (configurable 12h/24h/48h timeout)
- **Timeout rule**: Auto-play after timeout. 3 consecutive timeouts = auto-forfeit
- **Concurrent games**: Up to 5 async games simultaneously
- **Notification flow**:
  1. Push notification: `"Alex played Existential Pudding on you (+2). Stress: 7/10. Tap to play."`
  2. Tap opens app directly to game board
  3. See game state, your hand, everyone's stress
  4. Play your card in under 15 seconds
  5. Next player notified
- **Game pace**: 4-player round = 1–3 hours wall time. Full game = an afternoon or lazy day.
- **Re-engagement**: Follow-up push at 4 hours: "Your friends are waiting... [Player] is at stress 9!"

**Key principle**: Async state must be immediately readable. Open the game → see stress numbers, last 3 plays, your hand → decide in 15 seconds.

---

## iMessage Integration Plan

### Philosophy

iMessage is the **campfire** (where the story is told and social energy lives). The main app is the **game board** (where decisions happen).

### MVP (v1.0): Push Notifications + Share-to-iMessage

- **Turn prompts** via push notification (most reliable)
- **Game invites**: Share sheet generates rich link preview with deep link to game lobby
- **Share results**: After each round, "Share" button sends formatted message to iMessage:
  - `"MELTDOWN! Jamie hit stress 10 and dealt 8 to Alex with their tantrum! Round 2: Sam wins."`
- **Sticker pack**: 12–16 iMessage stickers shipped with the app: "You're Toast," "Zen Master," "Meltdown Incoming," "Not My Problem"

### v1.1: Full iMessage App Extension

- Compact game board in iMessage app drawer (stress meters + hand)
- Play turns directly from iMessage
- Each move composes an MSMessage showing the play result
- The iMessage thread becomes the game log
- Long-press any message to see full board state

### Per-Hand Social Beats (Async)

1. **Round start**: Shareable message with players and starting state
2. **Each turn**: Push to current player. Auto-share prompt for dramatic plays (stress >= 7, Swap, Zen, Chain Reaction)
3. **Meltdown**: Auto-generated shareable: "MELTDOWN! [Player] snapped! Tantrum dealt [X] to [target]!"
4. **Round end**: Scoreboard with rematch prompt
5. **Game end**: Final results with "Rematch?" deep link

### Technical Constraint

iOS does not allow apps to send iMessages automatically. The iMessage extension requires the user to hit "Send" — this is a feature: sending your move IS your announcement. Players can add trash talk before hitting send.

---

## Retention Systems

### Rematch Loop (Highest Priority)

One-tap "Rematch" button after every game. 30 minutes post-game push: "Ready for revenge? [Player] is still online." This single loop matters more than every other retention system combined.

### Daily Play Bonus

First game each day earns cosmetic currency. 3 consecutive days = bonus chest. Miss a day = no penalty, streak resets.

### Friend Streaks

Consecutive days playing with the same group. Milestones (3, 7, 14, 30 days) unlock shared cosmetics — matching card backs that only work when that group plays together.

### Season Rankings

Monthly seasons. ELO-based tiers: Chill → Warm → Hot → Volcanic → Meltdown. Tier badge on profile. End-of-season rewards. Optional — casual players never see rankings unless they opt in.

### Achievements

- "First Meltdown" — melt down for the first time
- "Zen Master" — play Zen at stress 9
- "Chain Reaction" — cascade 2+ meltdowns in one turn
- "Comeback Kid" — win after hitting stress 8+
- "Pacifist" — win without playing a single stress card
- "Not My Problem" — play 3 Dump cards in one round
- "Friendship Ender" — eliminate the same friend 10 times

### Weekly Challenges

Special modifiers: "Everyone starts at 5," "No Chill cards," "Double tantrum power." Completing 3/week earns bonus currency.

---

## Social Features

- **Friend system**: Game Center, contacts, share code
- **Groups**: Named persistent groups with group stats (wins, streaks, meltdowns caused)
- **Quick match**: One tap to play with any online friend
- **Spectator mode** (v1.2): Watch friends' games, react with floating emoji
- **Clip sharing** (v1.2): Auto-capture dramatic moments as short animated clips for social media

---

## Monetization Plan

### Core Principle

A free player and a paying player have identical gameplay. Money buys personality, not power. No pay-to-win. Ever.

### Revenue Streams

| Stream                  | Price          | Notes                                                                                |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------ |
| **Character cosmetics** | $1.99–$3.99   | Unique avatars + meltdown animations. 3 free, 10+ premium.                          |
| **Card back designs**   | $0.99–$1.99   | Visible to all players. Seasonal themes.                                             |
| **Meltdown effects**    | $1.99–$2.99   | Custom explosion when you CAUSE a meltdown. "Confetti Apocalypse," "Volcanic Eruption." |
| **Season Pass**         | $4.99/mo       | Exclusive character + card back + effect. Bonus coins. Ad-free. $3.99/mo if annual.  |
| **Sticker packs**       | $0.99          | iMessage sticker packs, themed each season.                                          |
| **Ad removal**          | $2.99 one-time | Free tier: one interstitial between games (not between rounds). Season pass = no ads. |

### Revenue Model

- Primary: Season Pass (recurring)
- Secondary: Character purchases (impulse)
- Tertiary: Ad removal (one-time)

---

## Balance Risks

| Risk                        | Severity | Mitigation                                                                                                          |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Turtle strategy             | Low      | Pressure Phase punishes stalling. Limited Chill cards. Social targeting.                                            |
| Pile-on / ganging up        | Medium   | Tantrum deters pile-ons (3–8 stress revenge). Players learn pushing someone out costs them.                         |
| Tantrum kingmaking          | Medium   | Max tantrum = 8 stress. Significant but not guaranteed lethal. Ranked mode could use 1.5x multiplier.               |
| Draw luck                   | Low-Med  | 5-card starting hand buffers. Dump/Swap as alt escape routes. Best-of-3 averages variance.                         |
| 2-player too swingy         | Low      | Best of 5 rounds. Quick rounds = bad luck doesn't sting.                                                           |
| Game length variance        | Low      | Attack:defense ratio ~2:1 in deck. Pressure Phase is hard convergence.                                             |
| Shield/Deflect too strong   | Low-Med  | 4 each in deck. Expire after one turn cycle. Cannot stack.                                                         |
| Zen too swingy              | Medium   | 2 in deck. Could reduce to 1 if dominant. Drama is a feature.                                                      |
| iMessage extension fragility | Medium   | Built as enhancement, not dependency. Full game works via push + main app.                                          |

**Critical note**: All card values need playtesting. Firebase Remote Config allows live balance tuning without app updates. Plan for 2–3 balance passes in the first month.

---

## Technical Architecture

### Client

- **SwiftUI** — all UI (game board, menus, social)
- **SpriteKit** — card animations, stress meter effects, meltdown explosions
- **Messages framework** — iMessage extension (v1.1)
- **Swift Package Manager** — dependencies

### Backend (Firebase)

- **Firebase Auth** — Apple Sign-In + anonymous auth
- **Cloud Firestore** — game state, user profiles, stats
- **Cloud Functions (Node.js)** — server-authoritative game logic
- **Firebase Cloud Messaging** — push notifications
- **Firebase Remote Config** — live balance tuning
- **Firebase Analytics** — funnels, retention

### Why Firebase

Solo dev. Auth, real-time DB, serverless functions, push, analytics in one SDK. Free tier covers early growth. If the game hits millions of users, Firestore costs become significant — but game logic is portable Node.js and the data model is simple enough to migrate.

### Data Model

```json
// games/{gameId}
{
  "id": "abc123",
  "players": ["uid1", "uid2", "uid3", "uid4"],
  "stressLevels": { "uid1": 3, "uid2": 7, "uid3": 5, "uid4": 3 },
  "currentTurn": "uid2",
  "turnOrder": ["uid1", "uid2", "uid3", "uid4"],
  "hands": { "uid1": ["card_12", "card_45"] },
  "drawPile": ["card_01", "card_02"],
  "discardPile": ["card_33"],
  "activeEffects": { "uid3": [{ "type": "shield", "expiresAfterTurn": "uid3" }] },
  "round": 2,
  "roundWins": { "uid1": 1, "uid2": 0, "uid3": 1, "uid4": 0 },
  "status": "active",
  "mode": "async",
  "turnDeadline": "2026-04-06T18:00:00Z",
  "turnLog": [
    { "player": "uid1", "card": "stress_2", "target": "uid2", "newStress": 7 }
  ]
}

// users/{userId}
{
  "displayName": "Alex",
  "avatarId": "jello_knight",
  "cardBackId": "default",
  "meltdownEffectId": "default",
  "stats": { "gamesPlayed": 47, "wins": 22, "meltdownsCaused": 31 },
  "coins": 450,
  "ownedCosmetics": ["jello_knight", "tax_return"],
  "friends": ["uid2", "uid3"],
  "elo": 1247
}
```

### Game Logic Flow (Cloud Function)

```
onPlayCard(gameId, playerId, cardId, targetId?):
  1. Validate: correct turn? Card in hand?
  2. Check target for Shield/Deflect → nullify or redirect
  3. Apply card effect (stress change, special)
  4. Remove card from hand → discard pile
  5. Check for Meltdown (any player >= 10)
     → If yes: mark eliminated, await Tantrum call
  6. Advance turn to next active player
  7. Check for round/game end
  8. Update Firestore game document
  9. Send push notification (async) or broadcast (sync)
```

### Sync vs Async Infrastructure

Both modes share the **same data model and game logic**. Only difference:

- **Sync**: Real-time Firestore listeners. 15s turn timer server-enforced.
- **Async**: Push notification per turn. Optional real-time listener if both online. 24h turn deadline.

One codebase. One set of rules. One server.

---

## MVP Scope

### In Scope (v1.0)

- Core game loop (all card types, meltdown, tantrum, pressure phase)
- Full 80-card deck with absurdist names
- 2–4 player online multiplayer (friends only, invite links)
- Real-time mode with turn timer
- Async mode with push notification turns
- Basic iMessage: share invites + round results, sticker pack
- 3 free character avatars with meltdown animations
- Core animations (card play, stress meter, meltdown, tantrum)
- Interactive tutorial (3 scripted turns)
- Firebase backend (auth, Firestore, Cloud Functions, FCM)
- Apple Sign-In + anonymous auth
- Basic stats (games played, wins, meltdowns caused)
- One-tap rematch

### Cut for Later

| Feature                       | Version |
| ----------------------------- | ------- |
| 5-player support              | v1.1    |
| Full iMessage App Extension   | v1.1    |
| Premium character shop        | v1.1    |
| Season Pass                   | v1.1    |
| Rankings / ELO                | v1.1    |
| Achievements                  | v1.1    |
| Random matchmaking            | v1.1    |
| Friend streaks                | v1.2    |
| Groups with stats             | v1.2    |
| Spectator mode                | v1.2    |
| Weekly challenges             | v1.2    |
| Clip sharing                  | v1.2    |
| Android                       | v2.0    |

### Build Estimate (Solo Dev)

| Phase                              | Duration   |
| ---------------------------------- | ---------- |
| Game logic engine + card system    | 2 weeks    |
| SwiftUI game board + hand UI       | 2 weeks    |
| Firebase backend + Cloud Functions | 2 weeks    |
| Multiplayer networking             | 2 weeks    |
| Animations + SpriteKit effects     | 1.5 weeks  |
| iMessage share + stickers          | 1 week     |
| Tutorial + onboarding              | 1 week     |
| Testing + balance tuning + polish  | 2 weeks    |
| **Total**                          | **~13 weeks** |

Budget 16 weeks (4 months) with buffer for unknowns and App Store review.

### Launch Strategy

1. TestFlight beta with 10–20 friends (2–3 weeks): balance tuning, fun validation, async UX
2. Soft launch in small market — New Zealand or Canada (2 weeks): retention metrics, crash monitoring
3. Full launch with ASO push

---

## Backup Concepts

### 1. HEXED (Score: 37/50)

Curse opponents with absurd hex tokens. Reckoning cards shuffled into deck — 3rd one triggers elimination of the most-hexed player. Could work as a second game mode inside Get Decked.

### 2. FLIP (Score: 36/50)

Dual-sided cards with positive/negative values. Build point combos; opponents FLIP your cards to reverse values. More strategic, less social. Different audience segment.

### 3. SLAP BACK (Score: 34/50)

Hurl absurd cards at opponents; they can deflect back with escalating power. Great social energy but bounce chains are awkward in async.

---

## Pitch & App Store Copy

### Elevator Pitch

Get Decked is an absurd card game where you play ridiculous stress cards on your friends until someone melts down — and gets one explosive last shot at revenge. 2–4 players, under 10 minutes, playable in real-time or async through iMessage. The game that melts friendships.

### App Store Listing

**Title**: Get Decked
**Subtitle**: The Card Game That Melts Friendships

Push your friends to the breaking point — literally.

Get Decked is the absurd card game where you play ridiculous stress cards on your opponents until someone MELTS DOWN. Haunted meatballs. Existential pudding. Surprise ghost audits. Use whatever you've got to push your friends over the edge while keeping your own cool.

But watch out — when someone melts down, they get one EXPLOSIVE last move. Target wisely, or their tantrum will take you down too.

PLAY YOUR WAY
- Real-time games in under 10 minutes
- Async mode: take turns throughout the day
- iMessage integration keeps the trash talk flowing
- 2-4 players, perfect for game night or your group chat

80 ABSURD CARDS, REAL DRAMA
- Stress your friends with increasingly ridiculous cards
- Shield yourself, dump your stress, or go full offense
- The rare Zen card can save you from the brink
- Chain Reactions can trigger cascading meltdowns

ZERO PAY-TO-WIN
- Full game is 100% free
- Cosmetic characters and effects only
- No card purchases, no gameplay advantages

Easy to learn. Impossible to stay calm.

**Keywords**: card game, multiplayer, party game, friends, async, iMessage, meltdown, casual, strategy, social
