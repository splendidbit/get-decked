export enum CardType {
  Stress = 'stress',
  Chill = 'chill',
  Zen = 'zen',
  Dump = 'dump',
  Shield = 'shield',
  Deflect = 'deflect',
  Snap = 'snap',
  ChainReaction = 'chainReaction',
  Swap = 'swap',
  Peek = 'peek',
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  value: number;
}

export interface ActiveEffect {
  type: 'shield' | 'deflect';
  redirectTargetId?: string;
  expiresAfterTurnOf: string;
}

export interface TurnLogEntry {
  playerId: string;
  cardName: string;
  cardType: CardType;
  targetId?: string;
  stressChange?: number;
  description: string;
}

export enum GameStatus {
  Waiting = 'waiting',
  Active = 'active',
  MeltdownPending = 'meltdownPending',
  RoundEnd = 'roundEnd',
  GameEnd = 'gameEnd',
}

export enum GameMode {
  Sync = 'sync',
  Async = 'async',
}

export interface GameState {
  id: string;
  players: string[];
  playerNames: Record<string, string>;
  stressLevels: Record<string, number>;
  currentTurnIndex: number;
  round: number;
  roundWins: Record<string, number>;
  roundsToWin: number;
  status: GameStatus;
  mode: GameMode;
  eliminatedPlayers: string[];
  activeEffects: Record<string, ActiveEffect[]>;
  turnLog: TurnLogEntry[];
  hostId: string;
  roomCode: string;
  isPressurePhase: boolean;
  turnDeadline: number | null;
  meltdownPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ServerState {
  drawPile: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
}

export interface PlayCardRequest {
  gameId: string;
  cardId: string;
  targetId?: string;
  deflectRedirectTargetId?: string;
  chainReactionSplashTargetId?: string;
  snapFollowUp?: {
    cardId: string;
    targetId?: string;
    deflectRedirectTargetId?: string;
    chainReactionSplashTargetId?: string;
  };
}

export interface TantrumRequest {
  gameId: string;
  cardId: string;
  targetId: string;
}

export interface GameEvent {
  type: string;
  playerId?: string;
  targetId?: string;
  cardName?: string;
  damage?: number;
  oldStress?: number;
  newStress?: number;
  description: string;
}
