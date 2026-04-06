import { GameState, GameEvent } from './types';

export function composeTurnNotification(gameState: GameState, playerId: string, lastEvent?: GameEvent): { title: string; body: string } {
  const playerName = gameState.playerNames[playerId];
  const stress = gameState.stressLevels[playerId];

  if (lastEvent && lastEvent.type === 'stressChanged' && lastEvent.playerId === playerId) {
    return { title: 'Get Decked', body: `${lastEvent.cardName || 'A card'} hit you! Stress: ${stress}/10. Your turn!` };
  }
  if (lastEvent && lastEvent.type === 'meltdown') {
    return { title: 'MELTDOWN!', body: `${gameState.playerNames[lastEvent.playerId!]} melted down! Your turn, ${playerName}.` };
  }
  return { title: 'Get Decked', body: `Your turn, ${playerName}! Stress: ${stress}/10.` };
}

export function composeMeltdownNotification(_gameState: GameState, _meltdownPlayerId: string): { title: string; body: string } {
  return { title: 'You MELTED DOWN!', body: 'Choose a card for your tantrum — make them pay!' };
}

export function composeRoundEndNotification(gameState: GameState, winnerId: string, playerId: string): { title: string; body: string } {
  const winnerName = gameState.playerNames[winnerId];
  if (playerId === winnerId) {
    return { title: 'You won the round!', body: `Round ${gameState.round} is yours. Wins: ${(gameState.roundWins[winnerId] || 0) + 1}/${gameState.roundsToWin}.` };
  }
  return { title: `${winnerName} won round ${gameState.round}`, body: `${winnerName} kept their cool. Next round starting soon!` };
}

export function composeShareMessage(gameState: GameState, events: GameEvent[]): string {
  const meltdownEvent = events.find(e => e.type === 'meltdown');
  const tantrumEvent = events.find(e => e.type === 'tantrum');
  if (meltdownEvent && tantrumEvent) {
    return `MELTDOWN in Get Decked! ${meltdownEvent.description} ${tantrumEvent.description}`;
  }
  const zenEvent = events.find(e => e.type === 'zenPlayed');
  if (zenEvent) return `ZEN in Get Decked! ${zenEvent.description}`;
  const swapEvent = events.find(e => e.type === 'swapped');
  if (swapEvent) return `SWAP in Get Decked! ${swapEvent.description}`;
  // suppress unused warning — gameState param is part of the public API
  void gameState;
  return '';
}
