import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { GameState, ServerState, GameMode, GameStatus, PlayCardRequest, TantrumRequest, GameEvent } from './types';
import { createGame, joinGame, startGame, resetRound } from './lifecycle';
import { drawCard, playCard, applyPressure } from './engine';
import { playTantrum } from './meltdown';
import { composeTurnNotification, composeMeltdownNotification } from './notifications';

initializeApp();
const db = getFirestore();

// ── Firestore path helpers ────────────────────────────────────────────────────

function gameDoc(gameId: string) {
  return db.collection('games').doc(gameId);
}

function serverStateDoc(gameId: string) {
  return db.collection('games').doc(gameId).collection('server').doc('state');
}

function handDoc(gameId: string, playerId: string) {
  return db.collection('games').doc(gameId).collection('hands').doc(playerId);
}

// ── Push notification helper ──────────────────────────────────────────────────

async function sendTurnNotification(
  gameId: string,
  gameState: GameState,
  events: GameEvent[],
): Promise<void> {
  if (gameState.mode !== GameMode.Async) return;

  try {
    let targetPlayerId: string;
    const meltdownEvent = events.find(e => e.type === 'meltdown');

    if (gameState.status === GameStatus.MeltdownPending && gameState.meltdownPlayerId) {
      targetPlayerId = gameState.meltdownPlayerId;
    } else {
      targetPlayerId = gameState.players[gameState.currentTurnIndex];
    }

    const userDoc = await db.collection('users').doc(targetPlayerId).get();
    if (!userDoc.exists) return;

    const fcmToken = userDoc.data()?.fcmToken as string | undefined;
    if (!fcmToken) return;

    let notification: { title: string; body: string };
    if (gameState.status === GameStatus.MeltdownPending && gameState.meltdownPlayerId === targetPlayerId) {
      notification = composeMeltdownNotification(gameState, targetPlayerId);
    } else {
      const lastEvent = meltdownEvent ?? events[events.length - 1];
      notification = composeTurnNotification(gameState, targetPlayerId, lastEvent);
    }

    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        gameId,
      },
    });
  } catch (err) {
    console.error('sendTurnNotification failed (non-fatal):', err);
  }
}

// ── Cloud Functions ───────────────────────────────────────────────────────────

export const createGameFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { mode, displayName } = request.data as { mode: GameMode; displayName: string };
  if (!mode || !displayName) {
    throw new HttpsError('invalid-argument', 'mode and displayName are required');
  }

  const hostId = request.auth.uid;
  const { gameState, serverState } = createGame(hostId, displayName, mode);

  await gameDoc(gameState.id).set(gameState);
  await serverStateDoc(gameState.id).set(serverState);

  return { gameId: gameState.id, roomCode: gameState.roomCode };
});

export const joinGameFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { roomCode, displayName } = request.data as { roomCode: string; displayName: string };
  if (!roomCode || !displayName) {
    throw new HttpsError('invalid-argument', 'roomCode and displayName are required');
  }

  const playerId = request.auth.uid;

  const snapshot = await db
    .collection('games')
    .where('roomCode', '==', roomCode)
    .where('status', '==', GameStatus.Waiting)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new HttpsError('not-found', 'No waiting game found with that room code');
  }

  const gameRef = snapshot.docs[0].ref;
  const gameData = snapshot.docs[0].data() as GameState;
  const gameId = gameData.id;

  let updatedGameState: GameState;
  try {
    updatedGameState = joinGame(gameData, playerId, displayName);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to join game';
    throw new HttpsError('failed-precondition', message);
  }

  await gameRef.set(updatedGameState);

  return { gameId };
});

export const startGameFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { gameId } = request.data as { gameId: string };
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId is required');
  }

  const requesterId = request.auth.uid;

  await db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameDoc(gameId));
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game not found');
    }

    const serverSnap = await tx.get(serverStateDoc(gameId));
    const gameState = gameSnap.data() as GameState;
    const serverState = (serverSnap.exists ? serverSnap.data() : { drawPile: [], discardPile: [], hands: {} }) as ServerState;

    let result: { gameState: GameState; serverState: ServerState };
    try {
      result = startGame(gameState, serverState, requesterId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      throw new HttpsError('failed-precondition', message);
    }

    const { gameState: newGameState, serverState: newServerState } = result;

    tx.set(gameDoc(gameId), newGameState);
    tx.set(serverStateDoc(gameId), {
      drawPile: newServerState.drawPile,
      discardPile: newServerState.discardPile,
    });

    for (const playerId of newGameState.players) {
      tx.set(handDoc(gameId, playerId), { cards: newServerState.hands[playerId] ?? [] });
    }
  });

  return { success: true };
});

export const playCardFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const cardRequest = request.data as PlayCardRequest;
  if (!cardRequest.gameId || !cardRequest.cardId) {
    throw new HttpsError('invalid-argument', 'gameId and cardId are required');
  }

  const playerId = request.auth.uid;
  const gameId = cardRequest.gameId;

  let finalGameState: GameState;
  let finalEvents: GameEvent[];

  await db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameDoc(gameId));
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game not found');
    }

    const serverSnap = await tx.get(serverStateDoc(gameId));
    const handSnap = await tx.get(handDoc(gameId, playerId));

    let gameState = gameSnap.data() as GameState;
    const serverStatePartial = (serverSnap.exists ? serverSnap.data() : { drawPile: [], discardPile: [] }) as { drawPile: ServerState['drawPile']; discardPile: ServerState['discardPile'] };

    // Reconstruct full server state by reading all hands
    const allHandSnaps = await Promise.all(
      gameState.players.map(pid => tx.get(handDoc(gameId, pid))),
    );
    const hands: ServerState['hands'] = {};
    for (let i = 0; i < gameState.players.length; i++) {
      const snap = allHandSnaps[i];
      hands[gameState.players[i]] = snap.exists ? (snap.data()?.cards ?? []) : [];
    }
    // Override with the player's own hand from the hand doc (already fetched)
    if (handSnap.exists) {
      hands[playerId] = handSnap.data()?.cards ?? [];
    }

    let serverState: ServerState = { ...serverStatePartial, hands };
    const events: GameEvent[] = [];

    // Apply pressure at the start of each turn cycle (when current player is first active player)
    if (gameState.isPressurePhase) {
      const activePlayers = gameState.players.filter(
        (p: string) => !gameState.eliminatedPlayers.includes(p),
      );
      const firstActivePlayer = activePlayers[0];
      const currentPlayer = gameState.players[gameState.currentTurnIndex];

      if (currentPlayer === firstActivePlayer) {
        const pressureResult = applyPressure(gameState, serverState);
        gameState = pressureResult.gameState;
        serverState = pressureResult.serverState;
        events.push(...pressureResult.events);

        // If pressure caused a meltdown, write state and return (tantrum needed)
        if (gameState.status === GameStatus.MeltdownPending) {
          tx.set(gameDoc(gameId), gameState as unknown as Record<string, unknown>);
          tx.set(serverStateDoc(gameId), {
            drawPile: serverState.drawPile,
            discardPile: serverState.discardPile,
          });
          for (const pid of gameState.players) {
            tx.set(handDoc(gameId, pid), { cards: serverState.hands[pid] ?? [] });
          }
          finalGameState = gameState;
          finalEvents = events;
          return;
        }
      }
    }

    let drawResult: ReturnType<typeof drawCard>;
    try {
      drawResult = drawCard(gameState, serverState, playerId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to draw card';
      throw new HttpsError('failed-precondition', message);
    }

    let playResult: ReturnType<typeof playCard>;
    try {
      playResult = playCard(drawResult.gameState, drawResult.serverState, playerId, cardRequest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to play card';
      throw new HttpsError('failed-precondition', message);
    }

    const { gameState: newGameState, serverState: newServerState, events: playEvents } = playResult;

    tx.set(gameDoc(gameId), newGameState);
    tx.set(serverStateDoc(gameId), {
      drawPile: newServerState.drawPile,
      discardPile: newServerState.discardPile,
    });

    for (const pid of newGameState.players) {
      tx.set(handDoc(gameId, pid), { cards: newServerState.hands[pid] ?? [] });
    }

    finalGameState = newGameState;
    finalEvents = [...events, ...playEvents];
  });

  // Track meltdown caused
  if (finalGameState!.status === GameStatus.MeltdownPending) {
    await updatePlayerStats(playerId, { meltdownsCaused: 1 });
  }

  // Send notification outside transaction (async mode only, failure is non-fatal)
  sendTurnNotification(gameId, finalGameState!, finalEvents!).catch(() => undefined);

  return { success: true };
});

export const playTantrumFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const tantrumRequest = request.data as TantrumRequest;
  if (!tantrumRequest.gameId || !tantrumRequest.cardId || !tantrumRequest.targetId) {
    throw new HttpsError('invalid-argument', 'gameId, cardId, and targetId are required');
  }

  const playerId = request.auth.uid;
  const gameId = tantrumRequest.gameId;

  let finalGameState: GameState;
  let finalEvents: GameEvent[];

  await db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameDoc(gameId));
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game not found');
    }

    const serverSnap = await tx.get(serverStateDoc(gameId));
    const gameState = gameSnap.data() as GameState;
    const serverStatePartial = (serverSnap.exists ? serverSnap.data() : { drawPile: [], discardPile: [] }) as { drawPile: ServerState['drawPile']; discardPile: ServerState['discardPile'] };

    const allHandSnaps = await Promise.all(
      gameState.players.map(pid => tx.get(handDoc(gameId, pid))),
    );
    const hands: ServerState['hands'] = {};
    for (let i = 0; i < gameState.players.length; i++) {
      const snap = allHandSnaps[i];
      hands[gameState.players[i]] = snap.exists ? (snap.data()?.cards ?? []) : [];
    }

    const serverState: ServerState = { ...serverStatePartial, hands };

    let result: ReturnType<typeof playTantrum>;
    try {
      result = playTantrum(gameState, serverState, playerId, tantrumRequest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to play tantrum';
      throw new HttpsError('failed-precondition', message);
    }

    const { gameState: newGameState, serverState: newServerState, events } = result;

    tx.set(gameDoc(gameId), newGameState);
    tx.set(serverStateDoc(gameId), {
      drawPile: newServerState.drawPile,
      discardPile: newServerState.discardPile,
    });

    for (const pid of newGameState.players) {
      tx.set(handDoc(gameId, pid), { cards: newServerState.hands[pid] ?? [] });
    }

    finalGameState = newGameState;
    finalEvents = events;
  });

  // Track stats after tantrum
  const finalState = finalGameState!;

  await updatePlayerStats(playerId, { tantrums: 1 });

  if (finalState.status === GameStatus.RoundEnd || finalState.status === GameStatus.GameEnd) {
    const winner = finalState.players.find((p: string) => !finalState.eliminatedPlayers.includes(p));
    if (winner) {
      await updatePlayerStats(winner, { wins: 1 });
    }
    if (finalState.status === GameStatus.GameEnd) {
      for (const pid of finalState.players) {
        await updatePlayerStats(pid, { gamesPlayed: 1 });
      }
    }
  }

  sendTurnNotification(gameId, finalGameState!, finalEvents!).catch(() => undefined);

  return { success: true };
});

export const startNextRoundFn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { gameId } = request.data as { gameId: string };
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId is required');
  }

  await db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameDoc(gameId));
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game not found');
    }

    const serverSnap = await tx.get(serverStateDoc(gameId));
    const gameState = gameSnap.data() as GameState;

    if (gameState.status !== GameStatus.RoundEnd) {
      throw new HttpsError('failed-precondition', `Cannot start next round: game status is ${gameState.status}`);
    }

    const serverStatePartial = (serverSnap.exists ? serverSnap.data() : { drawPile: [], discardPile: [] }) as { drawPile: ServerState['drawPile']; discardPile: ServerState['discardPile'] };

    const allHandSnaps = await Promise.all(
      gameState.players.map(pid => tx.get(handDoc(gameId, pid))),
    );
    const hands: ServerState['hands'] = {};
    for (let i = 0; i < gameState.players.length; i++) {
      const snap = allHandSnaps[i];
      hands[gameState.players[i]] = snap.exists ? (snap.data()?.cards ?? []) : [];
    }

    const serverState: ServerState = { ...serverStatePartial, hands };

    const { gameState: newGameState, serverState: newServerState } = resetRound(gameState, serverState);

    tx.set(gameDoc(gameId), newGameState);
    tx.set(serverStateDoc(gameId), {
      drawPile: newServerState.drawPile,
      discardPile: newServerState.discardPile,
    });

    for (const pid of newGameState.players) {
      tx.set(handDoc(gameId, pid), { cards: newServerState.hands[pid] ?? [] });
    }
  });

  return { success: true };
});

// ── Stats helper ──────────────────────────────────────────────────────────────

async function updatePlayerStats(
  playerId: string,
  updates: { gamesPlayed?: number; wins?: number; meltdownsCaused?: number; tantrums?: number },
) {
  const userRef = db.collection('users').doc(playerId);
  const increments: Record<string, unknown> = {};
  if (updates.gamesPlayed) increments['stats.gamesPlayed'] = FieldValue.increment(updates.gamesPlayed);
  if (updates.wins) increments['stats.wins'] = FieldValue.increment(updates.wins);
  if (updates.meltdownsCaused) increments['stats.meltdownsCaused'] = FieldValue.increment(updates.meltdownsCaused);
  if (updates.tantrums) increments['stats.tantrums'] = FieldValue.increment(updates.tantrums);
  if (Object.keys(increments).length > 0) {
    await userRef.update(increments).catch(() => {}); // silently fail if user doc doesn't exist
  }
}

// ── Rematch ───────────────────────────────────────────────────────────────────

export const rematchFn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data as { gameId: string };
  const oldGameRef = db.collection('games').doc(gameId);
  const oldGameDoc = await oldGameRef.get();

  if (!oldGameDoc.exists) throw new HttpsError('not-found', 'Game not found');
  const oldGame = oldGameDoc.data() as GameState;

  if (oldGame.status !== GameStatus.GameEnd) {
    throw new HttpsError('failed-precondition', 'Game is not over');
  }

  // Create new game with same players
  const { gameState: newGame, serverState: newServer } = createGame(uid, oldGame.playerNames[uid] || 'Player', oldGame.mode);

  const newGameRef = db.collection('games').doc();
  const newId = newGameRef.id;
  let gs = { ...newGame, id: newId };

  // Add all other players
  for (const pid of oldGame.players) {
    if (pid === uid) continue;
    gs = joinGame(gs, pid, oldGame.playerNames[pid] || 'Player');
  }

  // Auto-start the rematch
  const started = startGame(gs, newServer, uid);

  await newGameRef.set(started.gameState);
  await newGameRef.collection('server').doc('state').set(started.serverState);
  for (const pid of started.gameState.players) {
    await newGameRef.collection('hands').doc(pid).set({ cards: started.serverState.hands[pid] });
  }

  return { gameId: newId };
});

// ── Scheduled: turn timeouts ──────────────────────────────────────────────────

export const checkTurnTimeouts = onSchedule('every 1 minutes', async () => {
  const now = Date.now();

  // Find games with expired turn deadlines
  const expiredGames = await db.collection('games')
    .where('status', 'in', [GameStatus.Active, GameStatus.MeltdownPending])
    .where('turnDeadline', '<', now)
    .limit(10)
    .get();

  for (const doc of expiredGames.docs) {
    const gameState = doc.data() as GameState;
    const gameRef = doc.ref;

    try {
      // Load full server state (drawPile/discardPile + all hands from sub-docs)
      const serverDoc = await gameRef.collection('server').doc('state').get();
      const serverPartial = (serverDoc.exists ? serverDoc.data() : { drawPile: [], discardPile: [] }) as { drawPile: ServerState['drawPile']; discardPile: ServerState['discardPile'] };
      const allHands: ServerState['hands'] = {};
      for (const pid of gameState.players) {
        const handDocSnap = await gameRef.collection('hands').doc(pid).get();
        allHands[pid] = handDocSnap.exists ? (handDocSnap.data()?.cards ?? []) : [];
      }
      const serverStateForTimeout: ServerState = { ...serverPartial, hands: allHands };

      if (gameState.status === GameStatus.MeltdownPending) {
        // Auto-tantrum: pick first stress card in hand, or first card, target random opponent
        const serverState = serverStateForTimeout;
        const meltdownPlayer = gameState.meltdownPlayerId!;
        const hand = serverState.hands[meltdownPlayer] || [];

        if (hand.length === 0) {
          // No cards — skip tantrum, resolve meltdown
          const activePlayers = gameState.players.filter((p: string) => !gameState.eliminatedPlayers.includes(p));
          if (activePlayers.length <= 1) {
            // Round over
            const winner = activePlayers[0];
            const roundWins = { ...gameState.roundWins };
            roundWins[winner] = (roundWins[winner] || 0) + 1;
            const isGameOver = roundWins[winner] >= gameState.roundsToWin;
            await gameRef.update({
              status: isGameOver ? GameStatus.GameEnd : GameStatus.RoundEnd,
              roundWins,
              meltdownPlayerId: null,
              updatedAt: now,
            });
          } else {
            let nextIndex = gameState.currentTurnIndex;
            do {
              nextIndex = (nextIndex + 1) % gameState.players.length;
            } while (gameState.eliminatedPlayers.includes(gameState.players[nextIndex]));
            await gameRef.update({
              status: GameStatus.Active,
              meltdownPlayerId: null,
              currentTurnIndex: nextIndex,
              turnDeadline: gameState.mode === GameMode.Sync ? now + 15000 : now + 86400000,
              updatedAt: now,
            });
          }
          continue;
        }

        // Pick best tantrum card (highest stress card, or first card)
        const stressCards = hand.filter((c: { type: string }) => c.type === 'stress');
        const tantrumCard = stressCards.length > 0
          ? stressCards.reduce((a, b) => (a as { value: number }).value > (b as { value: number }).value ? a : b)
          : hand[0];

        // Pick random active target
        const activePlayers = gameState.players.filter(
          (p: string) => !gameState.eliminatedPlayers.includes(p),
        );
        const target = activePlayers[Math.floor(Math.random() * activePlayers.length)];

        // Execute tantrum via the same logic
        const result = playTantrum(gameState, serverState, meltdownPlayer, {
          gameId: gameState.id,
          cardId: (tantrumCard as { id: string }).id,
          targetId: target,
        });

        await gameRef.update(result.gameState as unknown as Record<string, unknown>);
        await gameRef.collection('server').doc('state').set(result.serverState);
        for (const pid of result.gameState.players) {
          await gameRef.collection('hands').doc(pid).set({ cards: result.serverState.hands[pid] });
        }

      } else if (gameState.status === GameStatus.Active) {
        // Auto-play: draw and play lowest stress card on random opponent, or play first chill/card
        const serverState = serverStateForTimeout;
        const currentPlayer = gameState.players[gameState.currentTurnIndex];

        // Draw
        const drawResult = drawCard(gameState, serverState, currentPlayer);
        const gs = drawResult.gameState;
        const ss = drawResult.serverState;

        const hand = ss.hands[currentPlayer];

        // Pick card to auto-play: lowest stress card targeting random opponent, or first chill, or first card
        const stressCards = hand.filter((c: { type: string }) => c.type === 'stress').sort((a: { value: number }, b: { value: number }) => a.value - b.value);
        const chillCards = hand.filter((c: { type: string }) => c.type === 'chill');

        const activePlayers = gs.players.filter((p: string) => !gs.eliminatedPlayers.includes(p) && p !== currentPlayer);
        const randomTarget = activePlayers[Math.floor(Math.random() * activePlayers.length)];

        let autoCard: { id: string; type: string; value?: number } | undefined;
        let autoRequest: { gameId: string; cardId: string; targetId?: string } | undefined;

        if (stressCards.length > 0 && randomTarget) {
          autoCard = stressCards[0];
          autoRequest = { gameId: gs.id, cardId: (autoCard as { id: string }).id, targetId: randomTarget };
        } else if (chillCards.length > 0) {
          autoCard = chillCards[0];
          autoRequest = { gameId: gs.id, cardId: (autoCard as { id: string }).id };
        } else {
          autoCard = hand[0] as { id: string; type: string };
          if (autoCard.type === 'stress' && randomTarget) {
            autoRequest = { gameId: gs.id, cardId: autoCard.id, targetId: randomTarget };
          } else if (['chill', 'zen', 'shield'].includes(autoCard.type)) {
            autoRequest = { gameId: gs.id, cardId: autoCard.id };
          } else {
            const simpleCard = hand.find((c: { type: string }) => ['stress', 'chill', 'zen', 'shield'].includes(c.type)) as { id: string; type: string } | undefined;
            if (simpleCard) {
              autoCard = simpleCard;
              if (simpleCard.type === 'stress' && randomTarget) {
                autoRequest = { gameId: gs.id, cardId: simpleCard.id, targetId: randomTarget };
              } else {
                autoRequest = { gameId: gs.id, cardId: simpleCard.id };
              }
            } else {
              autoRequest = { gameId: gs.id, cardId: (hand[0] as { id: string }).id, targetId: randomTarget };
            }
          }
        }

        try {
          const result = playCard(gs, ss, currentPlayer, autoRequest!);
          await gameRef.update(result.gameState as unknown as Record<string, unknown>);
          await gameRef.collection('server').doc('state').set(result.serverState);
          for (const pid of result.gameState.players) {
            await gameRef.collection('hands').doc(pid).set({ cards: result.serverState.hands[pid] });
          }
        } catch {
          // If auto-play fails, just advance the turn
          let nextIndex = gs.currentTurnIndex;
          do {
            nextIndex = (nextIndex + 1) % gs.players.length;
          } while (gs.eliminatedPlayers.includes(gs.players[nextIndex]));
          await gameRef.update({
            currentTurnIndex: nextIndex,
            turnDeadline: gs.mode === GameMode.Sync ? Date.now() + 15000 : Date.now() + 86400000,
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error(`Failed to process timeout for game ${doc.id}:`, err);
    }
  }
});

// ── Scheduled: async re-engagement reminders ──────────────────────────────────

export const sendAsyncReminders = onSchedule('every 1 hours', async () => {
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

  const staleGames = await db.collection('games')
    .where('mode', '==', GameMode.Async)
    .where('status', 'in', [GameStatus.Active, GameStatus.MeltdownPending])
    .where('updatedAt', '<', fourHoursAgo)
    .limit(20)
    .get();

  for (const doc of staleGames.docs) {
    const gs = doc.data() as GameState;
    const targetPlayer = gs.status === GameStatus.MeltdownPending
      ? gs.meltdownPlayerId
      : gs.players[gs.currentTurnIndex];

    if (!targetPlayer) continue;

    const userDoc = await db.collection('users').doc(targetPlayer).get();
    const fcmToken = userDoc.data()?.fcmToken as string | undefined;
    if (!fcmToken) continue;

    // Find highest stress player for drama
    const maxStressPlayer = gs.players
      .filter((p: string) => !gs.eliminatedPlayers.includes(p))
      .reduce((a: string, b: string) => (gs.stressLevels[a] || 0) > (gs.stressLevels[b] || 0) ? a : b);
    const maxStress = gs.stressLevels[maxStressPlayer] || 0;

    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: 'Your friends are waiting!',
          body: maxStress >= 7
            ? `${gs.playerNames[maxStressPlayer]} is at ${maxStress}/10 stress! Tap to play.`
            : `It's still your turn in Get Decked. Don't leave them hanging!`,
        },
        data: { gameId: doc.id },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch {
      // Ignore notification failures
    }
  }
});
