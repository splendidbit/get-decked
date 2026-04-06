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
