import {
  GameState,
  ServerState,
  Card,
  CardType,
  PlayCardRequest,
  GameEvent,
  ActiveEffect,
  GameStatus,
  GameMode,
} from './types';
import { shuffleDeck } from './cards';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DrawResult {
  gameState: GameState;
  serverState: ServerState;
  drawnCard: Card;
}

interface PlayResult {
  gameState: GameState;
  serverState: ServerState;
  events: GameEvent[];
}

interface ApplyStressResult {
  gameState: GameState;
  serverState: ServerState;
  events: GameEvent[];
  meltdownTriggered: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Apply `amount` of stress to `targetId`, respecting Shield and Deflect effects.
 * Returns the mutated state plus any events emitted.
 */
function applyStress(
  gameState: GameState,
  serverState: ServerState,
  targetId: string,
  amount: number,
  sourcePlayerId: string,
  cardName: string,
): ApplyStressResult {
  const events: GameEvent[] = [];
  const targetEffects: ActiveEffect[] = gameState.activeEffects[targetId] ?? [];

  // Check for Shield
  const shieldIndex = targetEffects.findIndex(e => e.type === 'shield');
  if (shieldIndex !== -1) {
    const newEffects = [...targetEffects];
    newEffects.splice(shieldIndex, 1);
    const newActiveEffects = { ...gameState.activeEffects, [targetId]: newEffects };
    events.push({
      type: 'shieldBlocked',
      playerId: sourcePlayerId,
      targetId,
      cardName,
      description: `${cardName} was blocked by ${gameState.playerNames[targetId]}'s shield.`,
    });
    return {
      gameState: { ...gameState, activeEffects: newActiveEffects },
      serverState,
      events,
      meltdownTriggered: false,
    };
  }

  // Check for Deflect
  const deflectIndex = targetEffects.findIndex(e => e.type === 'deflect');
  if (deflectIndex !== -1) {
    const deflectEffect = targetEffects[deflectIndex];
    const redirectTargetId = deflectEffect.redirectTargetId!;
    const newEffects = [...targetEffects];
    newEffects.splice(deflectIndex, 1);
    const newActiveEffects = { ...gameState.activeEffects, [targetId]: newEffects };

    events.push({
      type: 'deflected',
      playerId: sourcePlayerId,
      targetId,
      cardName,
      description: `${cardName} was deflected from ${gameState.playerNames[targetId]} to ${gameState.playerNames[redirectTargetId]}.`,
    });

    const deflectedResult = applyStress(
      { ...gameState, activeEffects: newActiveEffects },
      serverState,
      redirectTargetId,
      amount,
      sourcePlayerId,
      cardName,
    );
    return {
      ...deflectedResult,
      events: [...events, ...deflectedResult.events],
    };
  }

  // No active defensive effect — apply stress directly
  const oldStress = gameState.stressLevels[targetId] ?? 0;
  const newStress = Math.min(10, oldStress + amount);
  const newStressLevels = { ...gameState.stressLevels, [targetId]: newStress };

  events.push({
    type: 'stressChanged',
    playerId: sourcePlayerId,
    targetId,
    cardName,
    damage: amount,
    oldStress,
    newStress,
    description: `${gameState.playerNames[targetId]}'s stress changed from ${oldStress} to ${newStress}.`,
  });

  const meltdownTriggered = newStress >= 10;

  return {
    gameState: { ...gameState, stressLevels: newStressLevels },
    serverState,
    events,
    meltdownTriggered,
  };
}

/**
 * Move currentTurnIndex to the next non-eliminated player (wrapping).
 * Expires activeEffects where expiresAfterTurnOf matches the player whose
 * turn is *beginning* (i.e., the shield/deflect expires when its owner's
 * next turn starts — meaning it protected them through the full cycle).
 */
function advanceTurn(state: GameState): GameState {
  // Find next non-eliminated player
  let nextIndex = (state.currentTurnIndex + 1) % state.players.length;
  let safetyCounter = 0;
  while (state.eliminatedPlayers.includes(state.players[nextIndex])) {
    nextIndex = (nextIndex + 1) % state.players.length;
    safetyCounter++;
    if (safetyCounter > state.players.length) break; // all eliminated (shouldn't happen)
  }

  const nextPlayerId = state.players[nextIndex];

  // Expire effects that were set to expire when nextPlayer's turn arrives
  const updatedEffects = { ...state.activeEffects };
  for (const [pid, effects] of Object.entries(updatedEffects)) {
    updatedEffects[pid] = effects.filter(e => e.expiresAfterTurnOf !== nextPlayerId);
  }

  const turnDeadline =
    state.mode === GameMode.Sync
      ? Date.now() + 15000
      : Date.now() + 24 * 60 * 60 * 1000;

  return {
    ...state,
    currentTurnIndex: nextIndex,
    activeEffects: updatedEffects,
    turnDeadline,
    updatedAt: Date.now(),
  };
}

/**
 * Handle meltdown: mark the player as eliminated, set game status, record
 * meltdownPlayerId, add a turn-log entry. Does NOT advance the turn.
 */
function handleMeltdown(
  gameState: GameState,
  serverState: ServerState,
  events: GameEvent[],
  meltdownPlayerId: string,
  playerId: string,
  cardName: string,
  request: PlayCardRequest,
): PlayResult {
  const newEliminated = gameState.eliminatedPlayers.includes(meltdownPlayerId)
    ? gameState.eliminatedPlayers
    : [...gameState.eliminatedPlayers, meltdownPlayerId];

  events.push({
    type: 'meltdown',
    playerId,
    targetId: meltdownPlayerId,
    cardName,
    description: `${gameState.playerNames[meltdownPlayerId]} has melted down!`,
  });

  const finalState: GameState = {
    ...gameState,
    status: GameStatus.MeltdownPending,
    meltdownPlayerId,
    eliminatedPlayers: newEliminated,
    turnLog: [
      ...gameState.turnLog,
      {
        playerId,
        cardName,
        cardType: CardType.Stress, // will be overridden by caller if needed
        targetId: request.targetId,
        description: `${gameState.playerNames[playerId]} caused a meltdown!`,
      },
    ],
    updatedAt: Date.now(),
  };

  return { gameState: finalState, serverState, events };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Draw the top card from the drawPile into the player's hand.
 * If the drawPile is empty, shuffles discardPile into it and sets isPressurePhase=true.
 */
export function drawCard(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
): DrawResult {
  let gs = { ...gameState };
  let ss = { ...serverState };

  // Reshuffle if draw pile is empty
  if (ss.drawPile.length === 0) {
    const reshuffled = shuffleDeck([...ss.discardPile]);
    ss = { ...ss, drawPile: reshuffled, discardPile: [] };
    gs = { ...gs, isPressurePhase: true };
  }

  const [drawnCard, ...remainingDraw] = ss.drawPile;
  const playerHand = [...(ss.hands[playerId] ?? []), drawnCard];

  ss = {
    ...ss,
    drawPile: remainingDraw,
    hands: { ...ss.hands, [playerId]: playerHand },
  };

  return { gameState: gs, serverState: ss, drawnCard };
}

/**
 * Play a card from a player's hand, executing its effect and (usually)
 * advancing the turn. Returns the updated state and emitted events.
 */
export function playCard(
  gameState: GameState,
  serverState: ServerState,
  playerId: string,
  request: PlayCardRequest,
): PlayResult {
  // ── Validate game state ───────────────────────────────────────────────────
  if (gameState.status !== GameStatus.Active) {
    throw new Error(`Cannot play card: game status is ${gameState.status}`);
  }

  const currentPlayerId = gameState.players[gameState.currentTurnIndex];
  if (currentPlayerId !== playerId) {
    throw new Error(`Cannot play card: it is not ${playerId}'s turn`);
  }

  const hand = serverState.hands[playerId] ?? [];
  const cardIndex = hand.findIndex(c => c.id === request.cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${request.cardId} not found in ${playerId}'s hand`);
  }

  const card = hand[cardIndex];

  // ── Validate target constraints ───────────────────────────────────────────
  const targetRequiringTypes: CardType[] = [
    CardType.Stress,
    CardType.Dump,
    CardType.ChainReaction,
    CardType.Swap,
    CardType.Peek,
  ];

  if (targetRequiringTypes.includes(card.type)) {
    if (!request.targetId) {
      throw new Error(`Card ${card.type} requires a target`);
    }
    if (card.type === CardType.Stress || card.type === CardType.Dump) {
      if (request.targetId === playerId) {
        throw new Error(`Cannot target self with ${card.type}`);
      }
    }
    if (gameState.eliminatedPlayers.includes(request.targetId)) {
      throw new Error(`Cannot target an eliminated player`);
    }
  }

  if (card.type === CardType.Deflect && !request.deflectRedirectTargetId) {
    throw new Error('Deflect requires deflectRedirectTargetId');
  }

  if (card.type === CardType.Deflect && request.deflectRedirectTargetId === playerId) {
    throw new Error('Cannot deflect to yourself');
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

  // ── Execute card effect ───────────────────────────────────────────────────
  switch (card.type) {
    // ── Stress ───────────────────────────────────────────────────────────────
    case CardType.Stress: {
      const targetId = request.targetId!;
      const stressResult = applyStress(gs, ss, targetId, card.value, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        const meltResult = handleMeltdown(gs, ss, events, targetId, playerId, card.name, request);
        // Override the cardType in the last turnLog entry
        const updatedLog = [...meltResult.gameState.turnLog];
        updatedLog[updatedLog.length - 1] = { ...updatedLog[updatedLog.length - 1], cardType: card.type };
        return { ...meltResult, gameState: { ...meltResult.gameState, turnLog: updatedLog } };
      }
      break;
    }

    // ── Chill ─────────────────────────────────────────────────────────────────
    case CardType.Chill: {
      const oldStress = gs.stressLevels[playerId] ?? 0;
      const newStress = Math.max(0, oldStress - card.value);
      gs = { ...gs, stressLevels: { ...gs.stressLevels, [playerId]: newStress } };
      events.push({
        type: 'stressChanged',
        playerId,
        oldStress,
        newStress,
        cardName: card.name,
        description: `${gs.playerNames[playerId]}'s stress reduced from ${oldStress} to ${newStress}.`,
      });
      break;
    }

    // ── Zen ───────────────────────────────────────────────────────────────────
    case CardType.Zen: {
      const oldStress = gs.stressLevels[playerId] ?? 0;
      gs = { ...gs, stressLevels: { ...gs.stressLevels, [playerId]: 0 } };
      events.push({
        type: 'stressChanged',
        playerId,
        oldStress,
        newStress: 0,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} achieved zen — stress reset to 0.`,
      });
      break;
    }

    // ── Dump ──────────────────────────────────────────────────────────────────
    case CardType.Dump: {
      const targetId = request.targetId!;
      const DUMP_VALUE = 2;

      // Reduce own stress
      const oldSelfStress = gs.stressLevels[playerId] ?? 0;
      const newSelfStress = Math.max(0, oldSelfStress - DUMP_VALUE);
      gs = { ...gs, stressLevels: { ...gs.stressLevels, [playerId]: newSelfStress } };
      events.push({
        type: 'stressChanged',
        playerId,
        oldStress: oldSelfStress,
        newStress: newSelfStress,
        cardName: card.name,
        description: `${gs.playerNames[playerId]}'s stress reduced from ${oldSelfStress} to ${newSelfStress}.`,
      });

      // Apply stress to target
      const stressResult = applyStress(gs, ss, targetId, DUMP_VALUE, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        const meltResult = handleMeltdown(gs, ss, events, targetId, playerId, card.name, request);
        const updatedLog = [...meltResult.gameState.turnLog];
        updatedLog[updatedLog.length - 1] = { ...updatedLog[updatedLog.length - 1], cardType: card.type };
        return { ...meltResult, gameState: { ...meltResult.gameState, turnLog: updatedLog } };
      }
      break;
    }

    // ── Shield ────────────────────────────────────────────────────────────────
    case CardType.Shield: {
      const shieldEffect: ActiveEffect = {
        type: 'shield',
        expiresAfterTurnOf: playerId,
      };
      const existing = gs.activeEffects[playerId] ?? [];
      gs = {
        ...gs,
        activeEffects: { ...gs.activeEffects, [playerId]: [...existing, shieldEffect] },
      };
      events.push({
        type: 'shieldActivated',
        playerId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} raised a shield.`,
      });
      break;
    }

    // ── Deflect ───────────────────────────────────────────────────────────────
    case CardType.Deflect: {
      const redirectTargetId = request.deflectRedirectTargetId!;
      const deflectEffect: ActiveEffect = {
        type: 'deflect',
        redirectTargetId,
        expiresAfterTurnOf: playerId,
      };
      const existing = gs.activeEffects[playerId] ?? [];
      gs = {
        ...gs,
        activeEffects: { ...gs.activeEffects, [playerId]: [...existing, deflectEffect] },
      };
      events.push({
        type: 'deflectActivated',
        playerId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} set up a deflect toward ${gs.playerNames[redirectTargetId]}.`,
      });
      break;
    }

    // ── Swap ──────────────────────────────────────────────────────────────────
    case CardType.Swap: {
      const targetId = request.targetId!;
      const selfStress = gs.stressLevels[playerId] ?? 0;
      const targetStress = gs.stressLevels[targetId] ?? 0;

      gs = {
        ...gs,
        stressLevels: {
          ...gs.stressLevels,
          [playerId]: targetStress,
          [targetId]: selfStress,
        },
      };

      events.push({
        type: 'stressSwapped',
        playerId,
        targetId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} and ${gs.playerNames[targetId]} swapped stress levels.`,
      });

      // Defensive meltdown checks: both players must be alive (stress 0–9) before the swap,
      // so after swapping they each hold the other's pre-swap stress (also 0–9). In practice
      // neither can reach 10 via a swap alone. These checks are kept for correctness in case
      // future changes allow stress > 9 without elimination.
      if (targetStress >= 10) {
        // playerId now holds targetStress which was already >=10
        const meltResult = handleMeltdown(gs, ss, events, playerId, playerId, card.name, request);
        const updatedLog = [...meltResult.gameState.turnLog];
        updatedLog[updatedLog.length - 1] = { ...updatedLog[updatedLog.length - 1], cardType: card.type };
        return { ...meltResult, gameState: { ...meltResult.gameState, turnLog: updatedLog } };
      }
      if (selfStress >= 10) {
        // targetId now holds selfStress which was already >=10
        const meltResult = handleMeltdown(gs, ss, events, targetId, playerId, card.name, request);
        const updatedLog = [...meltResult.gameState.turnLog];
        updatedLog[updatedLog.length - 1] = { ...updatedLog[updatedLog.length - 1], cardType: card.type };
        return { ...meltResult, gameState: { ...meltResult.gameState, turnLog: updatedLog } };
      }
      break;
    }

    // ── Peek ──────────────────────────────────────────────────────────────────
    case CardType.Peek: {
      const targetId = request.targetId!;
      const targetHand = ss.hands[targetId] ?? [];
      events.push({
        type: 'peek',
        playerId,
        targetId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} peeked at ${gs.playerNames[targetId]}'s hand (${targetHand.length} cards).`,
      });

      // Draw 1 extra card if draw pile has cards
      if (ss.drawPile.length > 0) {
        const [extraCard, ...restDraw] = ss.drawPile;
        const updatedHand = [...(ss.hands[playerId] ?? []), extraCard];
        ss = {
          ...ss,
          drawPile: restDraw,
          hands: { ...ss.hands, [playerId]: updatedHand },
        };
        events.push({
          type: 'cardDrawn',
          playerId,
          cardName: extraCard.name,
          description: `${gs.playerNames[playerId]} drew a card from the Peek bonus.`,
        });
      }
      break;
    }

    // ── Snap ──────────────────────────────────────────────────────────────────
    case CardType.Snap: {
      if (!request.snapFollowUp) {
        throw new Error('Snap requires snapFollowUp');
      }
      const followUp = request.snapFollowUp;

      // Snap card is already removed from hand and discarded above.
      // Verify follow-up card is not another Snap
      const followUpHand = ss.hands[playerId] ?? [];
      const followUpCardIndex = followUpHand.findIndex(c => c.id === followUp.cardId);
      if (followUpCardIndex === -1) {
        throw new Error(`Follow-up card ${followUp.cardId} not found in hand`);
      }
      const followUpCard = followUpHand[followUpCardIndex];
      if (followUpCard.type === CardType.Snap) {
        throw new Error('Follow-up card for Snap cannot be another Snap');
      }

      events.push({
        type: 'snapPlayed',
        playerId,
        cardName: card.name,
        description: `${gs.playerNames[playerId]} snapped and plays an extra card!`,
      });

      // Build a follow-up PlayCardRequest
      const followUpRequest: PlayCardRequest = {
        gameId: request.gameId,
        cardId: followUp.cardId,
        targetId: followUp.targetId,
        deflectRedirectTargetId: followUp.deflectRedirectTargetId,
        chainReactionSplashTargetId: followUp.chainReactionSplashTargetId,
      };

      // Recursively call playCard for the follow-up card.
      // The follow-up must be played on the same player's turn, so we pass gs/ss as-is.
      const followUpResult = playCard(gs, ss, playerId, followUpRequest);

      // Merge the follow-up result: if it already advanced the turn or triggered
      // a meltdown, return that result (with merged events).
      return {
        gameState: followUpResult.gameState,
        serverState: followUpResult.serverState,
        events: [...events, ...followUpResult.events],
      };
    }

    // ── ChainReaction ─────────────────────────────────────────────────────────
    case CardType.ChainReaction: {
      const targetId = request.targetId!;
      const CHAIN_VALUE = 2;

      const stressResult = applyStress(gs, ss, targetId, CHAIN_VALUE, playerId, card.name);
      gs = stressResult.gameState;
      ss = stressResult.serverState;
      events.push(...stressResult.events);

      if (stressResult.meltdownTriggered) {
        // Splash to secondary target if provided
        if (request.chainReactionSplashTargetId) {
          const splashTargetId = request.chainReactionSplashTargetId;
          const splashResult = applyStress(gs, ss, splashTargetId, CHAIN_VALUE, playerId, card.name);
          gs = splashResult.gameState;
          ss = splashResult.serverState;
          events.push(...splashResult.events);

          // If the splash also triggers a meltdown, add the splash target to eliminatedPlayers
          // and emit a meltdown event for them. The primary target's tantrum is resolved first
          // (via MeltdownPending); after that, the chain-meltdown system will pick up the
          // splash target's pending elimination.
          if (splashResult.meltdownTriggered) {
            const splashEliminated = gs.eliminatedPlayers.includes(splashTargetId)
              ? gs.eliminatedPlayers
              : [...gs.eliminatedPlayers, splashTargetId];
            gs = { ...gs, eliminatedPlayers: splashEliminated };
            events.push({
              type: 'meltdown',
              playerId,
              targetId: splashTargetId,
              cardName: card.name,
              description: `${gs.playerNames[splashTargetId]} has melted down from the chain reaction splash!`,
            });
          }
        }

        const meltResult = handleMeltdown(gs, ss, events, targetId, playerId, card.name, request);
        const updatedLog = [...meltResult.gameState.turnLog];
        updatedLog[updatedLog.length - 1] = { ...updatedLog[updatedLog.length - 1], cardType: card.type };
        return { ...meltResult, gameState: { ...meltResult.gameState, turnLog: updatedLog } };
      }
      break;
    }

    default:
      throw new Error(`Unknown card type: ${(card as Card).type}`);
  }

  // ── Add turn log entry ────────────────────────────────────────────────────
  gs = {
    ...gs,
    turnLog: [
      ...gs.turnLog,
      {
        playerId,
        cardName: card.name,
        cardType: card.type,
        targetId: request.targetId,
        description: `${gs.playerNames[playerId]} played ${card.name}.`,
      },
    ],
    updatedAt: Date.now(),
  };

  // ── Advance turn ──────────────────────────────────────────────────────────
  gs = advanceTurn(gs);

  return { gameState: gs, serverState: ss, events };
}

/**
 * Apply +1 stress to all non-eliminated players. May trigger meltdowns.
 */
export function applyPressure(
  gameState: GameState,
  serverState: ServerState,
): PlayResult {
  let gs = { ...gameState };
  let ss = { ...serverState };
  const events: GameEvent[] = [];

  for (const playerId of gs.players) {
    if (gs.eliminatedPlayers.includes(playerId)) continue;

    const stressResult = applyStress(gs, ss, playerId, 1, 'pressure', 'Pressure Phase');
    gs = stressResult.gameState;
    ss = stressResult.serverState;
    events.push(...stressResult.events);

    if (stressResult.meltdownTriggered) {
      // Record meltdown and stop (handle one at a time for simplicity)
      const newEliminated = gs.eliminatedPlayers.includes(playerId)
        ? gs.eliminatedPlayers
        : [...gs.eliminatedPlayers, playerId];

      events.push({
        type: 'meltdown',
        targetId: playerId,
        cardName: 'Pressure Phase',
        description: `${gs.playerNames[playerId]} melted down from pressure!`,
      });

      gs = {
        ...gs,
        status: GameStatus.MeltdownPending,
        meltdownPlayerId: playerId,
        eliminatedPlayers: newEliminated,
        turnLog: [
          ...gs.turnLog,
          {
            playerId: 'pressure',
            cardName: 'Pressure Phase',
            cardType: CardType.Stress,
            targetId: playerId,
            description: `Pressure phase caused ${gs.playerNames[playerId]} to melt down!`,
          },
        ],
        updatedAt: Date.now(),
      };

      return { gameState: gs, serverState: ss, events };
    }
  }

  return { gameState: gs, serverState: ss, events };
}
