"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameMode = exports.GameStatus = exports.CardType = void 0;
var CardType;
(function (CardType) {
    CardType["Stress"] = "stress";
    CardType["Chill"] = "chill";
    CardType["Zen"] = "zen";
    CardType["Dump"] = "dump";
    CardType["Shield"] = "shield";
    CardType["Deflect"] = "deflect";
    CardType["Snap"] = "snap";
    CardType["ChainReaction"] = "chainReaction";
    CardType["Swap"] = "swap";
    CardType["Peek"] = "peek";
})(CardType || (exports.CardType = CardType = {}));
var GameStatus;
(function (GameStatus) {
    GameStatus["Waiting"] = "waiting";
    GameStatus["Active"] = "active";
    GameStatus["MeltdownPending"] = "meltdownPending";
    GameStatus["RoundEnd"] = "roundEnd";
    GameStatus["GameEnd"] = "gameEnd";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
var GameMode;
(function (GameMode) {
    GameMode["Sync"] = "sync";
    GameMode["Async"] = "async";
})(GameMode || (exports.GameMode = GameMode = {}));
//# sourceMappingURL=types.js.map