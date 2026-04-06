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
      gameId: gameState.id, cardId: 'big_stress', targetId: 'p2',
    });
    expect(result.gameState.stressLevels['p2']).toBe(3 + 8); // doubled
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
      gameId: gameState.id, cardId: 'shield1', targetId: 'p2',
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
      gameId: gameState.id, cardId: 's1', targetId: 'p2',
    });
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
      gameId: gameState.id, cardId: 'c1', targetId: 'p3',
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
      gameId: gameState.id, cardId: 's1', targetId: 'p3',
    })).toThrow('eliminated');
  });

  test('resolves to Active when round not over', () => {
    let { gameState, serverState } = setup3pGame();
    gameState.status = GameStatus.MeltdownPending;
    gameState.meltdownPlayerId = 'p1';
    gameState.eliminatedPlayers = ['p1'];
    gameState.stressLevels['p2'] = 3;
    const card = makeCard(CardType.Chill, 1, 'c1');
    serverState.hands['p1'] = [card];
    const result = playTantrum(gameState, serverState, 'p1', {
      gameId: gameState.id, cardId: 'c1', targetId: 'p2',
    });
    expect(result.gameState.status).toBe(GameStatus.Active);
    expect(result.gameState.meltdownPlayerId).toBeNull();
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
