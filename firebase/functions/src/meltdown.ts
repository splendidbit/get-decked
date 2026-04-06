import {
  GameState,
  ServerState,
  CardType,
  TantrumRequest,
  GameEvent,
  GameStatus,
} from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TantrumResult {
  gameState: GameState;
  serverState: ServerState;
  events: GameEvent[];
}

interface RoundEndResult {
  isOver: boolean;
  winnerId?: string;
  isGameOver?: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Count active (non-eliminated) players and determine if the round is over.
 * If one player remains, they are the winner. Checks whether that win pushes
 * them to roundsToWin for a game-over condition.
 */
export function checkRoundEnd(gameState: GameState): RoundEndResult {
  const activePlayers = gameState.players.filter(
    pid => !gameState.eliminatedPlayers.includes(pid),
  );

  if (activePlayers.length === 1) {
    const winnerId = activePlayers[0];
    const currentWins = gameState.roundWins[winnerId] ?? 0;
    const isGameOver = currentWins + 1 >= gameState.roundsToWin;
    return { isOver: true, winnerId, isGameOver };
  }

  return { isOver: false };
}

/**
 * Process a tantrum played by the eliminated (meltdown) player.
 *
 * - Validates turn, card ownership, and target legality.
 * - Computes damage: Stress card → value * 2, any other → 3.
 * - Applies damage directly (no shield/deflect check).
 * - Caps target stress at 10.
 * - If target reaches 10+: chain meltdown — eliminates target, sets
 *   meltdownPlayerId to target, keeps status MeltdownPending.
 * - If no chain meltdown: resolves the round via checkRoundEnd().
 */
export function playTantrum(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
  request: TantrumRequest,
): TantrumResult {
  // ── Validate ──────────────────────────────────────────────────────────────
  if (gameState.status !== GameStatus.MeltdownPending) {
    throw new Error(`Cannot play tantrum: game status is ${gameState.status}`);
  }

  if (gameState.meltdownPlayerId !== playerId) {
    throw new Error('Not your tantrum');
  }

  const hand = serverState.hands[playerId] ?? [];
  const cardIndex = hand.findIndex(c => c.id === request.cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${request.cardId} not found in ${playerId}'s hand`);
  }

  const card = hand[cardIndex];

  if (request.targetId === playerId) {
    throw new Error('Cannot target self with tantrum');
  }

  if (gameState.eliminatedPlayers.includes(request.targetId)) {
    throw new Error(`Cannot target an eliminated player`);
  }

  // ── Remove card from hand, add to discard ─────────────────────────────────
  const newHand = hand.filter((_c, i) => i !== cardIndex);
  let ss: ServerState = {
    ...serverState,
    hands: { ...serverState.hands, [playerId]: newHand },
    discardPile: [...serverState.discardPile, card],
  };
  let gs: GameState = { ...gameState };
  const events: GameEvent[] = [];

  // ── Calculate and apply damage ────────────────────────────────────────────
  const damage = card.type === CardType.Stress ? card.value * 2 : 3;
  const targetId = request.targetId;
  const oldStress = gs.stressLevels[targetId] ?? 0;
  const newStress = oldStress + damage;

  gs = {
    ...gs,
    stressLevels: { ...gs.stressLevels, [targetId]: newStress },
  };

  events.push({
    type: 'tantrumDamage',
    playerId,
    targetId,
    cardName: card.name,
    damage,
    oldStress,
    newStress,
    description: `${gs.playerNames[playerId]} threw a tantrum at ${gs.playerNames[targetId]}, dealing ${damage} stress (${oldStress} → ${newStress}).`,
  });

  // ── Chain meltdown check ──────────────────────────────────────────────────
  if (newStress >= 10) {
    const newEliminated = gs.eliminatedPlayers.includes(targetId)
      ? gs.eliminatedPlayers
      : [...gs.eliminatedPlayers, targetId];

    events.push({
      type: 'meltdown',
      playerId,
      targetId,
      cardName: card.name,
      description: `${gs.playerNames[targetId]} has melted down from the tantrum chain!`,
    });

    gs = {
      ...gs,
      eliminatedPlayers: newEliminated,
      meltdownPlayerId: targetId,
      status: GameStatus.MeltdownPending,
      updatedAt: Date.now(),
    };

    return { gameState: gs, serverState: ss, events };
  }

  // ── No chain meltdown — resolve round ────────────────────────────────────
  const roundResult = checkRoundEnd(gs);

  if (roundResult.isOver) {
    const winnerId = roundResult.winnerId!;
    const newRoundWins = {
      ...gs.roundWins,
      [winnerId]: (gs.roundWins[winnerId] ?? 0) + 1,
    };

    events.push({
      type: 'roundEnd',
      playerId: winnerId,
      description: `${gs.playerNames[winnerId]} won the round!`,
    });

    const newStatus = roundResult.isGameOver ? GameStatus.GameEnd : GameStatus.RoundEnd;

    if (roundResult.isGameOver) {
      events.push({
        type: 'gameEnd',
        playerId: winnerId,
        description: `${gs.playerNames[winnerId]} won the game!`,
      });
    }

    gs = {
      ...gs,
      roundWins: newRoundWins,
      status: newStatus,
      meltdownPlayerId: null,
      updatedAt: Date.now(),
    };

    return { gameState: gs, serverState: ss, events };
  }

  // ── Round continues — advance turn to next non-eliminated player ──────────
  let nextIndex = (gs.currentTurnIndex + 1) % gs.players.length;
  let safetyCounter = 0;
  while (gs.eliminatedPlayers.includes(gs.players[nextIndex])) {
    nextIndex = (nextIndex + 1) % gs.players.length;
    safetyCounter++;
    if (safetyCounter > gs.players.length) break;
  }

  gs = {
    ...gs,
    status: GameStatus.Active,
    meltdownPlayerId: null,
    currentTurnIndex: nextIndex,
    updatedAt: Date.now(),
  };

  return { gameState: gs, serverState: ss, events };
}
