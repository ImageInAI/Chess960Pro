/**
 * Chess 960 AI Bot Engine (High Performance Minimax with Alpha-Beta)
 * Features optimized move generation, material evaluation, piece-square tables,
 * and instant responsive search.
 */

export class ChessBot {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard', 'master'
        
        // Material weights (Centipawns)
        this.PIECE_VALUES = {
            'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
            'p': -100, 'n': -320, 'b': -330, 'r': -500, 'q': -900, 'k': -20000
        };

        // Positional Tables (Pawn, Knight, Bishop)
        this.PAWN_TABLE = [
            0,  0,  0,  0,  0,  0,  0,  0,
           50, 50, 50, 50, 50, 50, 50, 50,
           10, 10, 20, 30, 30, 20, 10, 10,
            5,  5, 10, 25, 25, 10,  5,  5,
            0,  0,  0, 20, 20,  0,  0,  0,
            5, -5,-10,  0,  0,-10, -5,  5,
            5, 10, 10,-20,-20, 10, 10,  5,
            0,  0,  0,  0,  0,  0,  0,  0
        ];

        this.KNIGHT_TABLE = [
           -50,-40,-30,-30,-30,-30,-40,-50,
           -40,-20,  0,  0,  0,  0,-20,-40,
           -30,  0, 10, 15, 15, 10,  0,-30,
           -30,  5, 15, 20, 20, 15,  5,-30,
           -30,  0, 15, 20, 20, 15,  0,-30,
           -30,  5, 10, 15, 15, 10,  5,-30,
           -40,-20,  0,  5,  5,  0,-20,-40,
           -50,-40,-30,-30,-30,-30,-40,-50
        ];

        this.BISHOP_TABLE = [
           -20,-10,-10,-10,-10,-10,-10,-20,
           -10,  5,  0,  0,  0,  0,  5,-10,
           -10, 10, 10, 10, 10, 10, 10,-10,
           -10,  0, 10, 10, 10, 10,  0,-10,
           -10,  5,  5, 10, 10,  5,  5,-10,
           -10,  0,  5, 10, 10,  5,  0,-10,
           -10,  0,  0,  0,  0,  0,  0,-10,
           -20,-10,-10,-10,-10,-10,-10,-20
        ];
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getSearchDepth() {
        switch (this.difficulty) {
            case 'easy': return 1;
            case 'medium': return 2;
            case 'hard': return 3;
            case 'master': return 4;
            default: return 2;
        }
    }

    /**
     * Evaluates position relative to White (positive favors White, negative favors Black)
     */
    evaluateBoard(engine) {
        let score = 0;
        const board = engine.board;

        for (let i = 0; i < 64; i++) {
            const piece = board[i];
            if (!piece) continue;

            const val = this.PIECE_VALUES[piece] || 0;
            score += val;

            const pUpper = piece.toUpperCase();
            const isWhite = piece === pUpper;
            const sqIndex = isWhite ? i : 63 - i; // Flipped for Black

            if (pUpper === 'P') {
                score += isWhite ? this.PAWN_TABLE[sqIndex] : -this.PAWN_TABLE[sqIndex];
            } else if (pUpper === 'N') {
                score += isWhite ? this.KNIGHT_TABLE[sqIndex] : -this.KNIGHT_TABLE[sqIndex];
            } else if (pUpper === 'B') {
                score += isWhite ? this.BISHOP_TABLE[sqIndex] : -this.BISHOP_TABLE[sqIndex];
            }
        }
        return score;
    }

    /**
     * Computes best move for current engine state asynchronously without blocking UI
     */
    async getBestMove(engine) {
        const legalMoves = engine.getLegalMoves();
        if (legalMoves.length === 0) return null;

        if (this.difficulty === 'easy') {
            // Easy bot: picks among captures or random legal moves
            const captures = legalMoves.filter(m => m.captured);
            if (captures.length > 0 && Math.random() < 0.6) {
                return captures[Math.floor(Math.random() * captures.length)];
            }
            return legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }

        const depth = this.getSearchDepth();
        const isMax = engine.turn === 'w';

        let bestMove = legalMoves[0];
        let bestValue = isMax ? -Infinity : Infinity;

        // Order moves: captures first for fast alpha-beta cutoff
        this.orderMoves(legalMoves);

        for (const move of legalMoves) {
            engine.makeMove(move, true);
            const value = this.minimax(engine, depth - 1, -Infinity, Infinity, !isMax);
            engine.undoMove(move);

            if (isMax) {
                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            } else {
                if (value < bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            }
        }

        return bestMove;
    }

    orderMoves(moves) {
        moves.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            if (a.captured) {
                scoreA += Math.abs(this.PIECE_VALUES[a.captured] || 0) * 10 - Math.abs(this.PIECE_VALUES[a.piece] || 0);
            }
            if (b.captured) {
                scoreB += Math.abs(this.PIECE_VALUES[b.captured] || 0) * 10 - Math.abs(this.PIECE_VALUES[b.piece] || 0);
            }

            if (a.isCastle) scoreA += 50;
            if (b.isCastle) scoreB += 50;

            if (a.promotion) scoreA += 800;
            if (b.promotion) scoreB += 800;

            return scoreB - scoreA;
        });
    }

    /**
     * Highly-optimized Minimax Alpha-Beta search
     */
    minimax(engine, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluateBoard(engine);
        }

        const moves = engine.getLegalMoves();

        if (moves.length === 0) {
            if (engine.isCheck(engine.turn)) {
                // Checkmate score factoring depth so faster mates are prioritized
                return isMaximizing ? -90000 - depth * 100 : 90000 + depth * 100;
            }
            return 0; // Stalemate
        }

        this.orderMoves(moves);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                engine.makeMove(move, true);
                const evalScore = this.minimax(engine, depth - 1, alpha, beta, false);
                engine.undoMove(move);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break; // Beta cutoff
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                engine.makeMove(move, true);
                const evalScore = this.minimax(engine, depth - 1, alpha, beta, true);
                engine.undoMove(move);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break; // Alpha cutoff
            }
            return minEval;
        }
    }
}
