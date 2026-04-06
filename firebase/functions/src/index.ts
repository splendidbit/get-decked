import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { GameState, ServerState, GameMode, GameStatus, PlayCardRequest, TantrumRequest, GameEvent } from './types';
import { createGame, joinGame, startGame, resetRound } from './lifecycle';
import { drawCard, playCard } from './engine';
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

    const gameState = gameSnap.data() as GameState;
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

    const serverState: ServerState = { ...serverStatePartial, hands };

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

    const { gameState: newGameState, serverState: newServerState, events } = playResult;

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
