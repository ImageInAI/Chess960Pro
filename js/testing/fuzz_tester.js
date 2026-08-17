/**
 * High-Speed Fuzzing & Stress Test Engine
 * Executes automated random bot self-play across randomly selected Chess960 positions,
 * validating invariant states (king safety, move legality, board corruption prevention, zero exceptions).
 */

import { Chess960Engine } from '../engine/chess960.js';

export class FuzzTester {
    constructor() {
        this.fuzzLog = [];
    }

    /**
     * Executes `gameCount` random self-play games up to `maxMovesPerGame` moves
     */
    async runFuzzSuite(gameCount = 10, maxMovesPerGame = 100, onProgress = null) {
        let totalMovesPlayed = 0;
        let gamesCompleted = 0;
        let illegalStatesDetected = 0;
        const startTime = performance.now();

        for (let g = 0; g < gameCount; g++) {
            const spIndex = Math.floor(Math.random() * 960);
            const engine = new Chess960Engine(spIndex);

            let moveCount = 0;
            while (!engine.isGameOver() && moveCount < maxMovesPerGame) {
                const moves = engine.getLegalMoves();
                if (moves.length === 0) break;

                // Pick random legal move
                const randomMove = moves[Math.floor(Math.random() * moves.length)];

                // Verify invariant before move
                if (engine.isCheck(engine.turn === 'w' ? 'b' : 'w')) {
                    // Check if previous turn opponent king was left in check
                    illegalStatesDetected++;
                    this.logFuzzError(`Game ${g} (SP-${spIndex}): Opponent king was left in check! FEN: ${engine.getFEN()}`);
                }

                const success = engine.makeMove(randomMove);
                if (!success) {
                    illegalStatesDetected++;
                    this.logFuzzError(`Game ${g} (SP-${spIndex}): Failed to execute legal move ${randomMove.san}`);
                    break;
                }

                moveCount++;
                totalMovesPlayed++;

                // Yield briefly to main thread to keep UI responsive
                if (totalMovesPlayed % 50 === 0) {
                    await new Promise(res => setTimeout(res, 0));
                    if (onProgress) {
                        onProgress({ game: g + 1, totalGames: gameCount, moves: totalMovesPlayed, errors: illegalStatesDetected });
                    }
                }
            }

            gamesCompleted++;
        }

        const durationMs = Math.round(performance.now() - startTime);

        return {
            gamesCompleted,
            totalMovesPlayed,
            illegalStatesDetected,
            durationMs,
            logs: this.fuzzLog
        };
    }

    logFuzzError(msg) {
        this.fuzzLog.push(`[FUZZ ERROR ${new Date().toLocaleTimeString()}] ${msg}`);
    }
}
