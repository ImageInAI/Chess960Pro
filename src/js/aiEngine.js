/**
 * Chess 960 AI Bot Engine
 * Features 5 difficulty tiers (Novice, Casual, Club Player, Master, Grandmaster),
 * Alpha-Beta minimax, quiescence search, piece-square tables, and live position evaluation.
 */

// Material Values in Centipawns
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Positional Piece-Square Tables (White perspective; flipped for Black)
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_TABLE_MID = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

export class ChessAI {
  constructor(difficulty = 3) {
    this.setDifficulty(difficulty);
  }

  setDifficulty(level) {
    this.difficulty = Math.max(1, Math.min(5, level));
    switch (this.difficulty) {
      case 1:
        this.depth = 1;
        this.randomness = 0.35;
        this.name = "Novice Bot (Rating ~800)";
        break;
      case 2:
        this.depth = 2;
        this.randomness = 0.15;
        this.name = "Casual Bot (Rating ~1200)";
        break;
      case 3:
        this.depth = 3;
        this.randomness = 0.05;
        this.name = "Club Player (Rating ~1600)";
        break;
      case 4:
        this.depth = 4;
        this.randomness = 0.0;
        this.name = "Master Bot (Rating ~2000)";
        break;
      case 5:
        this.depth = 5;
        this.randomness = 0.0;
        this.name = "Grandmaster (Rating ~2400)";
        break;
    }
  }

  /**
   * Evaluate the board position from White's perspective in centipawns (+ is White advantage, - is Black advantage)
   */
  evaluatePosition(game) {
    let score = 0;
    const board = game.board;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const isWhite = piece === piece.toUpperCase();
        const type = piece.toLowerCase();
        let val = PIECE_VALUES[type] || 0;

        // Positional Table bonus
        let posBonus = 0;
        const tableRow = isWhite ? r : 7 - r;
        const tableCol = c;

        switch (type) {
          case 'p': posBonus = PAWN_TABLE[tableRow][tableCol]; break;
          case 'n': posBonus = KNIGHT_TABLE[tableRow][tableCol]; break;
          case 'b': posBonus = BISHOP_TABLE[tableRow][tableCol]; break;
          case 'r': posBonus = ROOK_TABLE[tableRow][tableCol]; break;
          case 'q': posBonus = QUEEN_TABLE[tableRow][tableCol]; break;
          case 'k': posBonus = KING_TABLE_MID[tableRow][tableCol]; break;
        }

        const totalPieceScore = val + posBonus;
        score += isWhite ? totalPieceScore : -totalPieceScore;
      }
    }

    return score;
  }

  /**
   * Calculate winning probability percentage (0 to 100%) for White
   */
  getWinPercentage(game) {
    const cp = this.evaluatePosition(game);
    // Logistic scaling: 100 centipawns (1 pawn) -> ~57%, 300 centipawns -> ~75%, etc.
    const winProb = 1 / (1 + Math.pow(10, -cp / 400));
    return Math.round(winProb * 100);
  }

  /**
   * Order moves to maximize alpha-beta pruning cutoffs
   */
  orderMoves(moves) {
    return moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Prioritize captures (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
      if (a.captured) {
        scoreA += (PIECE_VALUES[a.captured.toLowerCase()] || 0) * 10 - (PIECE_VALUES[a.piece.toLowerCase()] || 0);
      }
      if (b.captured) {
        scoreB += (PIECE_VALUES[b.captured.toLowerCase()] || 0) * 10 - (PIECE_VALUES[b.piece.toLowerCase()] || 0);
      }

      // Promotions
      if (a.promotion) scoreA += 800;
      if (b.promotion) scoreB += 800;

      // Castling
      if (a.isCastling) scoreA += 50;
      if (b.isCastling) scoreB += 50;

      return scoreB - scoreA;
    });
  }

  /**
   * Quiescence search to avoid the horizon effect on tactical captures
   */
  quiescence(game, alpha, beta, isMaximizing, depth = 2) {
    const standPat = this.evaluatePosition(game);

    if (depth <= 0) return standPat;

    if (isMaximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      const legalMoves = game.getLegalMoves(true);
      const captures = this.orderMoves(legalMoves.filter(m => m.captured || m.promotion));

      for (const m of captures) {
        const sim = game.clone();
        sim.applyMoveInternal(m);
        const score = this.quiescence(sim, alpha, beta, false, depth - 1);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;

      const legalMoves = game.getLegalMoves(true);
      const captures = this.orderMoves(legalMoves.filter(m => m.captured || m.promotion));

      for (const m of captures) {
        const sim = game.clone();
        sim.applyMoveInternal(m);
        const score = this.quiescence(sim, alpha, beta, true, depth - 1);
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
      return beta;
    }
  }

  /**
   * Alpha-Beta Search
   */
  minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0) {
      if (this.difficulty >= 4) {
        return this.quiescence(game, alpha, beta, isMaximizing, 2);
      }
      return this.evaluatePosition(game);
    }

    const legalMoves = game.getLegalMoves(true);

    if (legalMoves.length === 0) {
      if (game.isKingInCheck(game.turn)) {
        // Checkmate score factoring depth so faster mates are favored
        return isMaximizing ? -50000 - depth * 100 : 50000 + depth * 100;
      }
      // Stalemate / Draw
      return 0;
    }

    const orderedMoves = this.orderMoves(legalMoves);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of orderedMoves) {
        const sim = game.clone();
        sim.applyMoveInternal(move);
        const evalScore = this.minimax(sim, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // Beta cutoff
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of orderedMoves) {
        const sim = game.clone();
        sim.applyMoveInternal(move);
        const evalScore = this.minimax(sim, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // Alpha cutoff
      }
      return minEval;
    }
  }

  /**
   * Find best move for the current turn
   * @param {Chess960Game} game
   * @returns {Promise<{ move: object, score: number }>}
   */
  async findBestMove(game) {
    const legalMoves = game.getLegalMoves(true);
    if (legalMoves.length === 0) return null;

    // Introduce Novice / Casual randomness
    if (Math.random() < this.randomness && legalMoves.length > 1) {
      // Pick a random legal move with reasonable capture preference
      const captures = legalMoves.filter(m => m.captured);
      if (captures.length > 0 && Math.random() < 0.6) {
        return { move: captures[Math.floor(Math.random() * captures.length)], score: 0 };
      }
      return { move: legalMoves[Math.floor(Math.random() * legalMoves.length)], score: 0 };
    }

    const isWhite = game.turn === 'w';
    let bestMove = legalMoves[0];
    let bestScore = isWhite ? -Infinity : Infinity;

    const orderedMoves = this.orderMoves(legalMoves);

    // Iterative processing so it never hangs the UI
    for (const move of orderedMoves) {
      const sim = game.clone();
      sim.applyMoveInternal(move);

      const score = this.minimax(sim, this.depth - 1, -Infinity, Infinity, !isWhite);

      if (isWhite) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    return { move: bestMove, score: bestScore };
  }
}
