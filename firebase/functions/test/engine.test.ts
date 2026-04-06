import { drawCard, playCard, applyPressure } from '../src/engine';
import { createGame, joinGame, startGame } from '../src/lifecycle';
import { GameMode, GameStatus, GameState, ServerState, Card, CardType, ActiveEffect } from '../src/types';

// ── helpers ──────────────────────────────────────────────────────────────────

let cardCounter = 0;

function makeCard(type: CardType, value = 1, id?: string): Card {
  const cardId = id ?? `test_card_${cardCounter++}`;
  const names: Record<CardType, string> = {
    [CardType.Stress]: 'Test Stress',
    [CardType.Chill]: 'Test Chill',
    [CardType.Zen]: 'Test Zen',
    [CardType.Dump]: 'Test Dump',
    [CardType.Shield]: 'Test Shield',
    [CardType.Deflect]: 'Test Deflect',
    [CardType.Snap]: 'Test Snap',
    [CardType.ChainReaction]: 'Test ChainReaction',
    [CardType.Swap]: 'Test Swap',
    [CardType.Peek]: 'Test Peek',
  };
  return {
    id: cardId,
    type,
    name: names[type],
    description: `A ${type} card for testing`,
    value,
  };
}

/** Creates a 3-player started game and fixes currentTurnIndex to 0 (p1). */
function setupGame(): { gameState: GameState; serverState: ServerState; p1: string; p2: string; p3: string } {
  const p1 = 'player1';
  const p2 = 'player2';
  const p3 = 'player3';

  let { gameState, serverState } = createGame(p1, 'Alice', GameMode.Sync);
  gameState = joinGame(gameState, p2, 'Bob');
  gameState = joinGame(gameState, p3, 'Carol');
  const started = startGame(gameState, serverState, p1);
  gameState = { ...started.gameState, currentTurnIndex: 0 };
  serverState = started.serverState;

  // Clear hands and inject known cards to avoid test randomness
  serverState = { ...serverState, hands: { [p1]: [], [p2]: [], [p3]: [] } };

  return { gameState, serverState, p1, p2, p3 };
}

// ── drawCard ──────────────────────────────────────────────────────────────────

describe('drawCard', () => {
  test('moves the top card from drawPile to player hand', () => {
    const { gameState, serverState, p1 } = setupGame();
    const topCard = makeCard(CardType.Chill, 2, 'draw_top');
    const patchedServer: ServerState = {
      ...serverState,
      drawPile: [topCard, makeCard(CardType.Stress, 1, 'draw_second')],
    };

    const result = drawCard(gameState, patchedServer, p1);

    expect(result.drawnCard.id).toBe('draw_top');
    expect(result.serverState.drawPile).toHaveLength(1);
    expect(result.serverState.drawPile[0].id).toBe('draw_second');
    expect(result.serverState.hands[p1]).toContainEqual(topCard);
  });

  test('enters pressure phase and shuffles discard into draw when pile is empty', () => {
    const { gameState, serverState, p1 } = setupGame();
    const discardCards = [makeCard(CardType.Stress, 1, 'd1'), makeCard(CardType.Chill, 1, 'd2')];
    const patchedServer: ServerState = {
      ...serverState,
      drawPile: [],
      discardPile: discardCards,
    };

    const result = drawCard(gameState, patchedServer, p1);

    expect(result.gameState.isPressurePhase).toBe(true);
    // Shuffled discard becomes new draw pile (minus the drawn card)
    expect(result.serverState.drawPile).toHaveLength(1);
    expect(result.serverState.discardPile).toHaveLength(0);
    // Drawn card should be in hand
    expect(result.serverState.hands[p1]).toHaveLength(1);
  });
});

// ── playCard – basic validations ──────────────────────────────────────────────

describe('playCard – validations', () => {
  test('rejects a card not in the player hand', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    // p1's hand is empty; try to play a card that isn't there
    expect(() =>
      playCard(gameState, serverState, p1, {
        gameId: gameState.id,
        cardId: 'nonexistent',
        targetId: p2,
      }),
    ).toThrow();
  });

  test('rejects play when game is not Active', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const card = makeCard(CardType.Stress, 1, 'c1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };
    const inactiveGame = { ...gameState, status: GameStatus.MeltdownPending };

    expect(() =>
      playCard(inactiveGame, patchedServer, p1, {
        gameId: gameState.id,
        cardId: card.id,
        targetId: p2,
      }),
    ).toThrow();
  });

  test('rejects play when it is not the player turn', () => {
    const { gameState, serverState, p2 } = setupGame();
    // currentTurnIndex=0 means p1's turn; p2 tries to play
    const card = makeCard(CardType.Chill, 1, 'c2');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p2]: [card] } };

    expect(() =>
      playCard(gameState, patchedServer, p2, {
        gameId: gameState.id,
        cardId: card.id,
      }),
    ).toThrow();
  });

  test('rejects stress card targeting self', () => {
    const { gameState, serverState, p1 } = setupGame();
    const card = makeCard(CardType.Stress, 1, 'c3');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };

    expect(() =>
      playCard(gameState, patchedServer, p1, {
        gameId: gameState.id,
        cardId: card.id,
        targetId: p1, // self-target
      }),
    ).toThrow();
  });
});

// ── playCard – Stress ─────────────────────────────────────────────────────────

describe('playCard – Stress', () => {
  test('adds stress to target', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const card = makeCard(CardType.Stress, 2, 'stress1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };
    const initialStress = gameState.stressLevels[p2];

    const result = playCard(gameState, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
      targetId: p2,
    });

    expect(result.gameState.stressLevels[p2]).toBe(initialStress + 2);
  });

  test('removes card from hand and puts it in discard', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const card = makeCard(CardType.Stress, 1, 'stress2');
    const otherCard = makeCard(CardType.Chill, 1, 'other1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card, otherCard] } };

    const result = playCard(gameState, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
      targetId: p2,
    });

    expect(result.serverState.hands[p1]).not.toContainEqual(card);
    expect(result.serverState.discardPile).toContainEqual(card);
    expect(result.serverState.hands[p1]).toContainEqual(otherCard);
  });
});

// ── playCard – Chill ──────────────────────────────────────────────────────────

describe('playCard – Chill', () => {
  test('reduces own stress by card value', () => {
    const { gameState, serverState, p1 } = setupGame();
    const card = makeCard(CardType.Chill, 2, 'chill1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };
    const patchedGame = { ...gameState, stressLevels: { ...gameState.stressLevels, [p1]: 5 } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
    });

    expect(result.gameState.stressLevels[p1]).toBe(3);
  });

  test('floors stress at 0', () => {
    const { gameState, serverState, p1 } = setupGame();
    const card = makeCard(CardType.Chill, 3, 'chill2');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };
    const patchedGame = { ...gameState, stressLevels: { ...gameState.stressLevels, [p1]: 1 } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
    });

    expect(result.gameState.stressLevels[p1]).toBe(0);
  });
});

// ── playCard – Zen ────────────────────────────────────────────────────────────

describe('playCard – Zen', () => {
  test('resets own stress to 0', () => {
    const { gameState, serverState, p1 } = setupGame();
    const card = makeCard(CardType.Zen, 0, 'zen1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };
    const patchedGame = { ...gameState, stressLevels: { ...gameState.stressLevels, [p1]: 8 } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
    });

    expect(result.gameState.stressLevels[p1]).toBe(0);
  });
});

// ── turn advancement ──────────────────────────────────────────────────────────

describe('turn advancement', () => {
  test('advances turn to next player after a normal play', () => {
    const { gameState, serverState, p1 } = setupGame();
    // currentTurnIndex=0 → p1 → after play → index 1 → p2
    const card = makeCard(CardType.Chill, 1, 'adv1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };

    const result = playCard(gameState, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
    });

    expect(result.gameState.currentTurnIndex).toBe(1);
  });

  test('skips eliminated players when advancing turn', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    // Eliminate p2 (index 1) so turn should jump from p1(0) to p3(2)
    const patchedGame = { ...gameState, eliminatedPlayers: [p2] };
    const card = makeCard(CardType.Chill, 1, 'adv2');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [card] } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: card.id,
    });

    expect(result.gameState.currentTurnIndex).toBe(2);
  });
});

// ── Shield ────────────────────────────────────────────────────────────────────

describe('Shield', () => {
  test('blocks incoming stress and is removed after blocking', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const shieldEffect: ActiveEffect = { type: 'shield', expiresAfterTurnOf: p2 };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p2]: 3 },
      activeEffects: { ...gameState.activeEffects, [p2]: [shieldEffect] },
    };
    const stressCard = makeCard(CardType.Stress, 3, 'block1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [stressCard] } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: stressCard.id,
      targetId: p2,
    });

    // Stress should not change
    expect(result.gameState.stressLevels[p2]).toBe(3);
    // Shield should be consumed
    expect(result.gameState.activeEffects[p2] ?? []).not.toContainEqual(shieldEffect);
    // Event emitted
    expect(result.events.some((e: import('../src/types').GameEvent) => e.type === 'shieldBlocked')).toBe(true);
  });

  test('playing a Shield card adds shield effect to player', () => {
    const { gameState, serverState, p1 } = setupGame();
    const shieldCard = makeCard(CardType.Shield, 0, 'shield_play1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [shieldCard] } };

    const result = playCard(gameState, patchedServer, p1, {
      gameId: gameState.id,
      cardId: shieldCard.id,
    });

    const effects = result.gameState.activeEffects[p1] ?? [];
    expect(effects.some((e: import('../src/types').ActiveEffect) => e.type === 'shield')).toBe(true);
  });
});

// ── Deflect ───────────────────────────────────────────────────────────────────

describe('Deflect', () => {
  test('redirects incoming stress to the redirect target', () => {
    const { gameState, serverState, p1, p2, p3 } = setupGame();
    const deflectEffect: ActiveEffect = { type: 'deflect', redirectTargetId: p3, expiresAfterTurnOf: p2 };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p2]: 3, [p3]: 3 },
      activeEffects: { ...gameState.activeEffects, [p2]: [deflectEffect] },
    };
    const stressCard = makeCard(CardType.Stress, 2, 'def1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [stressCard] } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: stressCard.id,
      targetId: p2, // deflect active on p2
    });

    // p2 stress unchanged
    expect(result.gameState.stressLevels[p2]).toBe(3);
    // p3 receives the deflected stress
    expect(result.gameState.stressLevels[p3]).toBe(5);
    expect(result.events.some((e: import('../src/types').GameEvent) => e.type === 'deflected')).toBe(true);
  });
});

// ── Dump ──────────────────────────────────────────────────────────────────────

describe('Dump', () => {
  test('reduces own stress by 2 and applies 2 stress to target', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const dumpCard = makeCard(CardType.Dump, 2, 'dump1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [dumpCard] } };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p1]: 5, [p2]: 3 },
    };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: dumpCard.id,
      targetId: p2,
    });

    expect(result.gameState.stressLevels[p1]).toBe(3);
    expect(result.gameState.stressLevels[p2]).toBe(5);
  });
});

// ── Swap ──────────────────────────────────────────────────────────────────────

describe('Swap', () => {
  test('trades stress levels between player and target', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const swapCard = makeCard(CardType.Swap, 0, 'swap1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [swapCard] } };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p1]: 7, [p2]: 2 },
    };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: swapCard.id,
      targetId: p2,
    });

    expect(result.gameState.stressLevels[p1]).toBe(2);
    expect(result.gameState.stressLevels[p2]).toBe(7);
  });
});

// ── Snap ──────────────────────────────────────────────────────────────────────

describe('Snap', () => {
  test('plays the snap card then the follow-up card', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const snapCard = makeCard(CardType.Snap, 0, 'snap1');
    const followUp = makeCard(CardType.Stress, 1, 'followup1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [snapCard, followUp] } };
    const initialStress = gameState.stressLevels[p2];

    const result = playCard(gameState, patchedServer, p1, {
      gameId: gameState.id,
      cardId: snapCard.id,
      snapFollowUp: {
        cardId: followUp.id,
        targetId: p2,
      },
    });

    // Both cards removed from hand
    expect(result.serverState.hands[p1]).not.toContainEqual(snapCard);
    expect(result.serverState.hands[p1]).not.toContainEqual(followUp);
    // Follow-up took effect
    expect(result.gameState.stressLevels[p2]).toBe(initialStress + 1);
  });
});

// ── ChainReaction ─────────────────────────────────────────────────────────────

describe('ChainReaction', () => {
  test('applies 2 stress to target', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const crCard = makeCard(CardType.ChainReaction, 2, 'cr1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [crCard] } };
    const patchedGame = { ...gameState, stressLevels: { ...gameState.stressLevels, [p2]: 3 } };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: crCard.id,
      targetId: p2,
    });

    expect(result.gameState.stressLevels[p2]).toBe(5);
  });

  test('splashes to splash target when primary target melts down', () => {
    const { gameState, serverState, p1, p2, p3 } = setupGame();
    const crCard = makeCard(CardType.ChainReaction, 2, 'cr2');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [crCard] } };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p2]: 9, [p3]: 3 }, // p2 will hit 11 (cap at 10 = meltdown)
    };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: crCard.id,
      targetId: p2,
      chainReactionSplashTargetId: p3,
    });

    // p2 should melt down
    expect(result.gameState.status).toBe(GameStatus.MeltdownPending);
    expect(result.gameState.meltdownPlayerId).toBe(p2);
    // p3 receives splash stress
    expect(result.gameState.stressLevels[p3]).toBe(5);
  });
});

// ── Meltdown ──────────────────────────────────────────────────────────────────

describe('Meltdown', () => {
  test('sets status to MeltdownPending and records meltdownPlayerId when stress hits 10', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const stressCard = makeCard(CardType.Stress, 4, 'melt1');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [stressCard] } };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p2]: 7 }, // 7 + 4 = 11 → meltdown
    };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: stressCard.id,
      targetId: p2,
    });

    expect(result.gameState.status).toBe(GameStatus.MeltdownPending);
    expect(result.gameState.meltdownPlayerId).toBe(p2);
    expect(result.gameState.eliminatedPlayers).toContain(p2);
    // Turn should NOT advance on meltdown
    expect(result.gameState.currentTurnIndex).toBe(0);
  });

  test('does not advance turn when meltdown is pending', () => {
    const { gameState, serverState, p1, p2 } = setupGame();
    const stressCard = makeCard(CardType.Stress, 8, 'melt2');
    const patchedServer = { ...serverState, hands: { ...serverState.hands, [p1]: [stressCard] } };
    const patchedGame = {
      ...gameState,
      stressLevels: { ...gameState.stressLevels, [p2]: 9 },
    };

    const result = playCard(patchedGame, patchedServer, p1, {
      gameId: gameState.id,
      cardId: stressCard.id,
      targetId: p2,
    });

    expect(result.gameState.currentTurnIndex).toBe(0); // still p1's turn (meltdown resolution pending)
  });
});

// ── applyPressure ─────────────────────────────────────────────────────────────

describe('applyPressure', () => {
  test('adds 1 stress to all active players', () => {
    const { gameState, serverState, p1, p2, p3 } = setupGame();
    const patchedGame = {
      ...gameState,
      stressLevels: { [p1]: 2, [p2]: 3, [p3]: 4 },
    };

    const result = applyPressure(patchedGame, serverState);

    expect(result.gameState.stressLevels[p1]).toBe(3);
    expect(result.gameState.stressLevels[p2]).toBe(4);
    expect(result.gameState.stressLevels[p3]).toBe(5);
  });

  test('skips eliminated players when applying pressure', () => {
    const { gameState, serverState, p1, p2, p3 } = setupGame();
    const patchedGame = {
      ...gameState,
      stressLevels: { [p1]: 2, [p2]: 3, [p3]: 4 },
      eliminatedPlayers: [p2],
    };

    const result = applyPressure(patchedGame, serverState);

    expect(result.gameState.stressLevels[p1]).toBe(3);
    expect(result.gameState.stressLevels[p2]).toBe(3); // unchanged
    expect(result.gameState.stressLevels[p3]).toBe(5);
  });
});
