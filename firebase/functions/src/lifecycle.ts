import { GameMode, GameState, GameStatus, ServerState } from './types';
import { buildDeck, shuffleDeck } from './cards';

const MAX_PLAYERS = 4;
const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARSET[Math.floor(Math.random() * ROOM_CODE_CHARSET.length)];
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
    id: `game_${now}_${Math.random().toString(36).slice(2, 8)}`,
    players: [hostId],
    playerNames: { [hostId]: hostName },
    stressLevels: {},
    currentTurnIndex: 0,
    round: 1,
    roundWins: {},
    roundsToWin: 0,
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
  if (state.players.length >= MAX_PLAYERS) {
    throw new Error('Game is full');
  }
  if (state.players.includes(playerId)) {
    throw new Error('Already in game');
  }

  return {
    ...state,
    players: [...state.players, playerId],
    playerNames: { ...state.playerNames, [playerId]: playerName },
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
    throw new Error('Game requires at least 2 players');
  }

  const deck = shuffleDeck(buildDeck());
  const hands: Record<string, import('./types').Card[]> = {};

  for (const playerId of state.players) {
    hands[playerId] = deck.splice(0, 5);
  }

  const stressLevels: Record<string, number> = {};
  for (const playerId of state.players) {
    stressLevels[playerId] = 3;
  }

  const roundsToWin = state.players.length === 2 ? 5 : 3;
  const currentTurnIndex = Math.floor(Math.random() * state.players.length);
  const now = Date.now();

  const gameState: GameState = {
    ...state,
    status: GameStatus.Active,
    stressLevels,
    currentTurnIndex,
    roundsToWin,
    eliminatedPlayers: [],
    turnLog: [],
    isPressurePhase: false,
    meltdownPlayerId: null,
    updatedAt: now,
  };

  const newServerState: ServerState = {
    drawPile: deck,
    discardPile: [],
    hands,
  };

  return { gameState, serverState: newServerState };
}

export function resetRound(
  state: GameState,
  serverState: ServerState,
): { gameState: GameState; serverState: ServerState } {
  const deck = shuffleDeck(buildDeck());
  const hands: Record<string, import('./types').Card[]> = {};

  for (const playerId of state.players) {
    hands[playerId] = deck.splice(0, 5);
  }

  const stressLevels: Record<string, number> = {};
  for (const playerId of state.players) {
    stressLevels[playerId] = 3;
  }

  const currentTurnIndex = Math.floor(Math.random() * state.players.length);
  const now = Date.now();

  const gameState: GameState = {
    ...state,
    status: GameStatus.Active,
    stressLevels,
    currentTurnIndex,
    round: state.round + 1,
    eliminatedPlayers: [],
    turnLog: [],
    isPressurePhase: false,
    meltdownPlayerId: null,
    updatedAt: now,
  };

  const newServerState: ServerState = {
    drawPile: deck,
    discardPile: [],
    hands,
  };

  return { gameState, serverState: newServerState };
}
