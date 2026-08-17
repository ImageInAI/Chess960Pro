/**
 * Chess 960 Rules & Move Validation Engine
 * Complete implementation of piece moves, Chess960 castling, check/mate/stalemate detection,
 * en-passant, pawn promotion, and FEN/PGN serialization.
 */

import { generateChess960Position, getChess960Id } from './chess960.js';

export const PIECE_SYMBOLS = {
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚',
  p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔'
};

export const PIECE_NAMES = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
};

export class Chess960Game {
  constructor(positionId = 518) {
    this.initGame(positionId);
  }

  initGame(positionId = 518) {
    this.positionId = positionId;
    this.backRank = generateChess960Position(positionId);
    
    // 8x8 Board representation: null or piece char (e.g. 'P', 'p', 'R', etc.)
    // row 0: Black back rank, row 1: Black pawns, ..., row 6: White pawns, row 7: White back rank
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));

    // Fill Pawns
    for (let c = 0; c < 8; c++) {
      this.board[1][c] = 'p';
      this.board[6][c] = 'P';
    }

    // Fill Back Ranks
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = this.backRank[c].toLowerCase();
      this.board[7][c] = this.backRank[c];
    }

    // Find initial King and Rook file indices
    let kFile = -1;
    let rFiles = [];
    for (let c = 0; c < 8; c++) {
      if (this.backRank[c] === 'K') kFile = c;
      if (this.backRank[c] === 'R') rFiles.push(c);
    }

    this.initialKingCol = kFile;
    this.initialQueensideRookCol = rFiles[0];
    this.initialKingsideRookCol = rFiles[1];

    this.turn = 'w'; // 'w' or 'b'
    this.castlingRights = {
      w: { k: true, q: true, kRookCol: rFiles[1], qRookCol: rFiles[0] },
      b: { k: true, q: true, kRookCol: rFiles[1], qRookCol: rFiles[0] }
    };

    this.enPassantSquare = null; // { row, col } or null
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;

    this.moveHistory = [];
    this.positionHistory = [];
    this.capturedPieces = { w: [], b: [] }; // pieces captured by white, black

    this.gameState = {
      isGameOver: false,
      winner: null, // 'w', 'b', or 'draw'
      reason: '' // 'checkmate', 'stalemate', 'draw-50-move', 'threefold', 'insufficient-material', 'resignation', 'timeout'
    };

    this.recordPositionSnapshot();
  }

  clone() {
    const copy = Object.create(Chess960Game.prototype);
    copy.positionId = this.positionId;
    copy.backRank = this.backRank;
    copy.board = this.board.map(row => [...row]);
    copy.initialKingCol = this.initialKingCol;
    copy.initialQueensideRookCol = this.initialQueensideRookCol;
    copy.initialKingsideRookCol = this.initialKingsideRookCol;
    copy.turn = this.turn;
    copy.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    copy.enPassantSquare = this.enPassantSquare ? { ...this.enPassantSquare } : null;
    copy.halfmoveClock = this.halfmoveClock;
    copy.fullmoveNumber = this.fullmoveNumber;
    copy.moveHistory = [...this.moveHistory];
    copy.positionHistory = [...this.positionHistory];
    copy.capturedPieces = {
      w: [...this.capturedPieces.w],
      b: [...this.capturedPieces.b]
    };
    copy.gameState = { ...this.gameState };
    return copy;
  }

  isWhitePiece(piece) {
    return piece && piece === piece.toUpperCase();
  }

  isBlackPiece(piece) {
    return piece && piece === piece.toLowerCase();
  }

  getPieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'w' : 'b';
  }

  getPieceAt(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  /**
   * Generates all pseudo-legal and legal moves for the current turn.
   */
  getLegalMoves(filterByCheck = true) {
    const moves = [];
    const color = this.turn;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === color) {
          const pieceMoves = this.getPieceMoves(r, c);
          moves.push(...pieceMoves);
        }
      }
    }

    if (!filterByCheck) return moves;

    // Filter out moves that leave king in check
    return moves.filter(m => {
      const sim = this.clone();
      sim.applyMoveInternal(m);
      return !sim.isKingInCheck(color);
    });
  }

  /**
   * Get legal moves specifically for a selected piece at (fromRow, fromCol)
   */
  getLegalMovesForSquare(fromRow, fromCol) {
    const all = this.getLegalMoves(true);
    return all.filter(m => m.from.row === fromRow && m.from.col === fromCol);
  }

  getPieceMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];

    const color = this.getPieceColor(piece);
    const type = piece.toLowerCase();
    const moves = [];

    switch (type) {
      case 'p':
        this.addPawnMoves(r, c, color, moves);
        break;
      case 'n':
        this.addKnightMoves(r, c, color, moves);
        break;
      case 'b':
        this.addBishopMoves(r, c, color, moves);
        break;
      case 'r':
        this.addRookMoves(r, c, color, moves);
        break;
      case 'q':
        this.addQueenMoves(r, c, color, moves);
        break;
      case 'k':
        this.addKingMoves(r, c, color, moves);
        break;
    }

    return moves;
  }

  addPawnMoves(r, c, color, moves) {
    const forward = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    // Single step
    const nextR = r + forward;
    if (nextR >= 0 && nextR <= 7 && !this.board[nextR][c]) {
      if (nextR === promoRow) {
        ['Q', 'R', 'B', 'N'].forEach(promo => {
          moves.push({
            from: { row: r, col: c },
            to: { row: nextR, col: c },
            piece: this.board[r][c],
            promotion: color === 'w' ? promo : promo.toLowerCase()
          });
        });
      } else {
        moves.push({
          from: { row: r, col: c },
          to: { row: nextR, col: c },
          piece: this.board[r][c]
        });

        // Double step
        const doubleR = r + forward * 2;
        if (r === startRow && !this.board[doubleR][c]) {
          moves.push({
            from: { row: r, col: c },
            to: { row: doubleR, col: c },
            piece: this.board[r][c],
            isDoublePawn: true
          });
        }
      }
    }

    // Captures
    [-1, 1].forEach(dc => {
      const capCol = c + dc;
      if (capCol >= 0 && capCol <= 7) {
        const targetPiece = this.board[nextR]?.[capCol];
        if (targetPiece && this.getPieceColor(targetPiece) !== color) {
          if (nextR === promoRow) {
            ['Q', 'R', 'B', 'N'].forEach(promo => {
              moves.push({
                from: { row: r, col: c },
                to: { row: nextR, col: capCol },
                piece: this.board[r][c],
                captured: targetPiece,
                promotion: color === 'w' ? promo : promo.toLowerCase()
              });
            });
          } else {
            moves.push({
              from: { row: r, col: c },
              to: { row: nextR, col: capCol },
              piece: this.board[r][c],
              captured: targetPiece
            });
          }
        } else if (this.enPassantSquare && this.enPassantSquare.row === nextR && this.enPassantSquare.col === capCol) {
          // En Passant
          const capturedPawn = this.board[r][capCol];
          moves.push({
            from: { row: r, col: c },
            to: { row: nextR, col: capCol },
            piece: this.board[r][c],
            captured: capturedPawn,
            isEnPassant: true
          });
        }
      }
    });
  }

  addKnightMoves(r, c, color, moves) {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of offsets) {
      const tr = r + dr;
      const tc = c + dc;
      if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const target = this.board[tr][tc];
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({
            from: { row: r, col: c },
            to: { row: tr, col: tc },
            piece: this.board[r][c],
            captured: target || null
          });
        }
      }
    }
  }

  addSlidingMoves(r, c, color, directions, moves) {
    for (const [dr, dc] of directions) {
      let tr = r + dr;
      let tc = c + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const target = this.board[tr][tc];
        if (!target) {
          moves.push({
            from: { row: r, col: c },
            to: { row: tr, col: tc },
            piece: this.board[r][c]
          });
        } else {
          if (this.getPieceColor(target) !== color) {
            moves.push({
              from: { row: r, col: c },
              to: { row: tr, col: tc },
              piece: this.board[r][c],
              captured: target
            });
          }
          break;
        }
        tr += dr;
        tc += dc;
      }
    }
  }

  addBishopMoves(r, c, color, moves) {
    this.addSlidingMoves(r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
  }

  addRookMoves(r, c, color, moves) {
    this.addSlidingMoves(r, c, color, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
  }

  addQueenMoves(r, c, color, moves) {
    this.addSlidingMoves(r, c, color, [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ], moves);
  }

  addKingMoves(r, c, color, moves) {
    // Normal King moves
    const offsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of offsets) {
      const tr = r + dr;
      const tc = c + dc;
      if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const target = this.board[tr][tc];
        if (!target || this.getPieceColor(target) !== color) {
          moves.push({
            from: { row: r, col: c },
            to: { row: tr, col: tc },
            piece: this.board[r][c],
            captured: target || null
          });
        }
      }
    }

    // Chess 960 Castling Moves
    this.addChess960CastlingMoves(r, c, color, moves);
  }

  /**
   * Chess 960 Castling Rules:
   * - Kingside (O-O): King ends on g1 (g8), Rook ends on f1 (f8).
   * - Queenside (O-O-O): King ends on c1 (c8), Rook ends on d1 (d8).
   */
  addChess960CastlingMoves(kRow, kCol, color, moves) {
    const rights = this.castlingRights[color];
    const backRow = color === 'w' ? 7 : 0;
    if (kRow !== backRow) return;

    // Can't castle out of check
    if (this.isSquareAttacked(kRow, kCol, color === 'w' ? 'b' : 'w')) {
      return;
    }

    // Kingside Castling (c-file or g-file / O-O)
    if (rights.k && rights.kRookCol !== null) {
      const rCol = rights.kRookCol;
      const destKingCol = 6; // g-file
      const destRookCol = 5; // f-file

      if (this.isCastlingPathClear(kRow, kCol, rCol, destKingCol, destRookCol, color)) {
        moves.push({
          from: { row: kRow, col: kCol },
          to: { row: kRow, col: destKingCol },
          piece: this.board[kRow][kCol],
          isCastling: true,
          castleSide: 'k',
          rookFromCol: rCol,
          rookToCol: destRookCol,
          targetRookCol: rCol
        });
      }
    }

    // Queenside Castling (a-file or c-file / O-O-O)
    if (rights.q && rights.qRookCol !== null) {
      const rCol = rights.qRookCol;
      const destKingCol = 2; // c-file
      const destRookCol = 3; // d-file

      if (this.isCastlingPathClear(kRow, kCol, rCol, destKingCol, destRookCol, color)) {
        moves.push({
          from: { row: kRow, col: kCol },
          to: { row: kRow, col: destKingCol },
          piece: this.board[kRow][kCol],
          isCastling: true,
          castleSide: 'q',
          rookFromCol: rCol,
          rookToCol: destRookCol,
          targetRookCol: rCol
        });
      }
    }
  }

  isCastlingPathClear(row, kCol, rCol, destKingCol, destRookCol, color) {
    const enemyColor = color === 'w' ? 'b' : 'w';

    // 1. Check all squares King travels through (excluding start, including dest)
    const kMin = Math.min(kCol, destKingCol);
    const kMax = Math.max(kCol, destKingCol);

    for (let c = kMin; c <= kMax; c++) {
      // King's path cannot pass through attack
      if (c !== kCol && this.isSquareAttacked(row, c, enemyColor)) {
        return false;
      }
      // Must be empty, unless it's the current King or castling Rook
      if (c !== kCol && c !== rCol && this.board[row][c] !== null) {
        return false;
      }
    }

    // 2. Check all squares Rook travels through (excluding start, including dest)
    const rMin = Math.min(rCol, destRookCol);
    const rMax = Math.max(rCol, destRookCol);

    for (let c = rMin; c <= rMax; c++) {
      if (c !== kCol && c !== rCol && this.board[row][c] !== null) {
        return false;
      }
    }

    // 3. Squares between King and Rook starting positions must be empty
    const betweenMin = Math.min(kCol, rCol) + 1;
    const betweenMax = Math.max(kCol, rCol) - 1;
    for (let c = betweenMin; c <= betweenMax; c++) {
      if (c !== destKingCol && c !== destRookCol && this.board[row][c] !== null) {
        return false;
      }
    }

    return true;
  }

  isSquareAttacked(row, col, attackerColor) {
    // Check pawns
    const pDirection = attackerColor === 'w' ? 1 : -1; // attacking upwards if white
    const pawnRow = row + pDirection;
    if (pawnRow >= 0 && pawnRow <= 7) {
      const pawnChar = attackerColor === 'w' ? 'P' : 'p';
      if (col - 1 >= 0 && this.board[pawnRow][col - 1] === pawnChar) return true;
      if (col + 1 <= 7 && this.board[pawnRow][col + 1] === pawnChar) return true;
    }

    // Check knights
    const knightChar = attackerColor === 'w' ? 'N' : 'n';
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const tr = row + dr;
      const tc = col + dc;
      if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        if (this.board[tr][tc] === knightChar) return true;
      }
    }

    // Check diagonals (Bishops, Queens)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const bChar = attackerColor === 'w' ? 'B' : 'b';
    const qChar = attackerColor === 'w' ? 'Q' : 'q';
    for (const [dr, dc] of diagDirs) {
      let tr = row + dr;
      let tc = col + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const p = this.board[tr][tc];
        if (p) {
          if (p === bChar || p === qChar) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }

    // Check straights (Rooks, Queens)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const rChar = attackerColor === 'w' ? 'R' : 'r';
    for (const [dr, dc] of straightDirs) {
      let tr = row + dr;
      let tc = col + dc;
      while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        const p = this.board[tr][tc];
        if (p) {
          if (p === rChar || p === qChar) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }

    // Check King proximity
    const kChar = attackerColor === 'w' ? 'K' : 'k';
    const kingOffsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of kingOffsets) {
      const tr = row + dr;
      const tc = col + dc;
      if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
        if (this.board[tr][tc] === kChar) return true;
      }
    }

    return false;
  }

  isKingInCheck(color) {
    const kChar = color === 'w' ? 'K' : 'k';
    let kRow = -1, kCol = -1;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === kChar) {
          kRow = r;
          kCol = c;
          break;
        }
      }
      if (kRow !== -1) break;
    }

    if (kRow === -1) return false;
    return this.isSquareAttacked(kRow, kCol, color === 'w' ? 'b' : 'w');
  }

  /**
   * Internal move application without deep validation (used for minimax/simulation)
   */
  applyMoveInternal(move) {
    const { from, to, piece, captured, promotion, isCastling, isEnPassant } = move;
    const color = this.getPieceColor(piece);
    const backRow = color === 'w' ? 7 : 0;

    if (isCastling) {
      // Clear initial squares
      this.board[from.row][from.col] = null;
      this.board[backRow][move.rookFromCol] = null;
      // Place King and Rook in standard castling destination squares
      this.board[to.row][to.col] = color === 'w' ? 'K' : 'k';
      this.board[backRow][move.rookToCol] = color === 'w' ? 'R' : 'r';

      this.castlingRights[color].k = false;
      this.castlingRights[color].q = false;
    } else {
      this.board[from.row][from.col] = null;

      if (isEnPassant) {
        const capturedPawnRow = color === 'w' ? to.row + 1 : to.row - 1;
        this.board[capturedPawnRow][to.col] = null;
      }

      this.board[to.row][to.col] = promotion || piece;

      // Update castling rights if King or Rook moves
      if (piece.toLowerCase() === 'k') {
        this.castlingRights[color].k = false;
        this.castlingRights[color].q = false;
      } else if (piece.toLowerCase() === 'r') {
        if (from.row === backRow && from.col === this.castlingRights[color].kRookCol) {
          this.castlingRights[color].k = false;
        }
        if (from.row === backRow && from.col === this.castlingRights[color].qRookCol) {
          this.castlingRights[color].q = false;
        }
      }

      // If a rook is captured on its starting square
      const enemyColor = color === 'w' ? 'b' : 'w';
      const enemyBackRow = enemyColor === 'w' ? 7 : 0;
      if (to.row === enemyBackRow) {
        if (to.col === this.castlingRights[enemyColor].kRookCol) {
          this.castlingRights[enemyColor].k = false;
        }
        if (to.col === this.castlingRights[enemyColor].qRookCol) {
          this.castlingRights[enemyColor].q = false;
        }
      }
    }

    // Update en passant square
    if (move.isDoublePawn) {
      this.enPassantSquare = {
        row: color === 'w' ? from.row - 1 : from.row + 1,
        col: from.col
      };
    } else {
      this.enPassantSquare = null;
    }

    // Halfmove clock
    if (piece.toLowerCase() === 'p' || captured) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }

    this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  /**
   * Execute a move in the game and record history, algebraic notation, and game over state.
   */
  makeMove(moveInput) {
    if (this.gameState.isGameOver) return { success: false, reason: 'Game is already over' };

    // Resolve move if given as { from: {row, col}, to: {row, col} }
    let legalMove = null;
    const legalMoves = this.getLegalMoves(true);

    if (typeof moveInput === 'object') {
      legalMove = legalMoves.find(m => {
        const fromMatch = m.from.row === moveInput.from.row && m.from.col === moveInput.from.col;
        const toMatch = m.to.row === moveInput.to.row && m.to.col === moveInput.to.col;
        // Castling click on rook fallback
        const castleRookMatch = m.isCastling && m.from.row === moveInput.from.row && m.rookFromCol === moveInput.to.col;
        const promoMatch = !moveInput.promotion || m.promotion === moveInput.promotion;
        return fromMatch && (toMatch || castleRookMatch) && promoMatch;
      });
    }

    if (!legalMove) {
      return { success: false, reason: 'Illegal move' };
    }

    // Capture tracking
    if (legalMove.captured) {
      this.capturedPieces[this.turn].push(legalMove.captured);
    }

    // Generate Standard Algebraic Notation (SAN) before applying
    const san = this.generateSAN(legalMove, legalMoves);
    legalMove.san = san;

    // Apply the move
    this.applyMoveInternal(legalMove);

    // Add to history
    this.moveHistory.push(legalMove);
    this.recordPositionSnapshot();

    // Check game over conditions
    this.updateGameOverState();

    return {
      success: true,
      move: legalMove,
      san,
      isCheck: this.isKingInCheck(this.turn),
      gameState: this.gameState
    };
  }

  generateSAN(move, legalMoves) {
    if (move.isCastling) {
      return move.castleSide === 'k' ? 'O-O' : 'O-O-O';
    }

    const pieceType = move.piece.toUpperCase();
    const isPawn = pieceType === 'P';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromFile = files[move.from.col];
    const fromRank = 8 - move.from.row;
    const toFile = files[move.to.col];
    const toRank = 8 - move.to.row;

    let san = '';

    if (!isPawn) {
      san += pieceType;

      // Disambiguation
      const ambiguousMoves = legalMoves.filter(m => 
        m.piece.toUpperCase() === pieceType &&
        m.to.row === move.to.row &&
        m.to.col === move.to.col &&
        (m.from.row !== move.from.row || m.from.col !== move.from.col)
      );

      if (ambiguousMoves.length > 0) {
        const sameFile = ambiguousMoves.some(m => m.from.col === move.from.col);
        const sameRank = ambiguousMoves.some(m => m.from.row === move.from.row);

        if (!sameFile) {
          san += fromFile;
        } else if (!sameRank) {
          san += fromRank;
        } else {
          san += fromFile + fromRank;
        }
      }
    }

    if (move.captured || move.isEnPassant) {
      if (isPawn) san += fromFile;
      san += 'x';
    }

    san += toFile + toRank;

    if (move.promotion) {
      san += '=' + move.promotion.toUpperCase();
    }

    // Check / Mate indicators
    const sim = this.clone();
    sim.applyMoveInternal(move);
    const nextLegal = sim.getLegalMoves(true);
    if (sim.isKingInCheck(sim.turn)) {
      if (nextLegal.length === 0) {
        san += '#';
      } else {
        san += '+';
      }
    }

    return san;
  }

  recordPositionSnapshot() {
    const fen = this.generateFEN();
    const fenKey = fen.split(' ').slice(0, 4).join(' ');
    this.positionHistory.push(fenKey);
  }

  updateGameOverState() {
    const legalMoves = this.getLegalMoves(true);
    const inCheck = this.isKingInCheck(this.turn);

    if (legalMoves.length === 0) {
      this.gameState.isGameOver = true;
      if (inCheck) {
        this.gameState.winner = this.turn === 'w' ? 'b' : 'w';
        this.gameState.reason = 'checkmate';
      } else {
        this.gameState.winner = 'draw';
        this.gameState.reason = 'stalemate';
      }
      return;
    }

    // 50-move rule
    if (this.halfmoveClock >= 100) {
      this.gameState.isGameOver = true;
      this.gameState.winner = 'draw';
      this.gameState.reason = 'draw-50-move';
      return;
    }

    // Threefold repetition
    const currentKey = this.positionHistory[this.positionHistory.length - 1];
    const occurrences = this.positionHistory.filter(k => k === currentKey).length;
    if (occurrences >= 3) {
      this.gameState.isGameOver = true;
      this.gameState.winner = 'draw';
      this.gameState.reason = 'threefold';
      return;
    }

    // Insufficient material
    if (this.hasInsufficientMaterial()) {
      this.gameState.isGameOver = true;
      this.gameState.winner = 'draw';
      this.gameState.reason = 'insufficient-material';
      return;
    }
  }

  hasInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) pieces.push({ piece: p, row: r, col: c });
      }
    }

    // King vs King
    if (pieces.length === 2) return true;

    // King + minor piece vs King
    if (pieces.length === 3) {
      const nonKing = pieces.find(p => p.piece.toLowerCase() !== 'k');
      if (nonKing && (nonKing.piece.toLowerCase() === 'b' || nonKing.piece.toLowerCase() === 'n')) {
        return true;
      }
    }

    // King + Bishop vs King + Bishop on same color squares
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => p.piece.toLowerCase() === 'b');
      if (bishops.length === 2 && this.getPieceColor(bishops[0].piece) !== this.getPieceColor(bishops[1].piece)) {
        const color1 = (bishops[0].row + bishops[0].col) % 2;
        const color2 = (bishops[1].row + bishops[1].col) % 2;
        if (color1 === color2) return true;
      }
    }

    return false;
  }

  generateFEN() {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += p;
        }
      }
      if (emptyCount > 0) rowStr += emptyCount;
      rows.push(rowStr);
    }

    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let castle = '';
    if (this.castlingRights.w.k && this.castlingRights.w.kRookCol !== null) castle += files[this.castlingRights.w.kRookCol];
    if (this.castlingRights.w.q && this.castlingRights.w.qRookCol !== null) castle += files[this.castlingRights.w.qRookCol];
    if (this.castlingRights.b.k && this.castlingRights.b.kRookCol !== null) castle += files[this.castlingRights.b.kRookCol].toLowerCase();
    if (this.castlingRights.b.q && this.castlingRights.b.qRookCol !== null) castle += files[this.castlingRights.b.qRookCol].toLowerCase();
    if (!castle) castle = '-';

    let ep = '-';
    if (this.enPassantSquare) {
      ep = files[this.enPassantSquare.col].toLowerCase() + (8 - this.enPassantSquare.row);
    }

    return `${rows.join('/')} ${this.turn} ${castle} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`;
  }

  generatePGN(eventTitle = "Chess960 Match", whitePlayer = "White", blackPlayer = "Black") {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    let result = '*';
    if (this.gameState.isGameOver) {
      if (this.gameState.winner === 'w') result = '1-0';
      else if (this.gameState.winner === 'b') result = '0-1';
      else if (this.gameState.winner === 'draw') result = '1/2-1/2';
    }

    let pgn = `[Event "${eventTitle}"]\n`;
    pgn += `[Site "Chess 960 Offline/Online Suite"]\n`;
    pgn += `[Date "${date}"]\n`;
    pgn += `[Round "1"]\n`;
    pgn += `[White "${whitePlayer}"]\n`;
    pgn += `[Black "${blackPlayer}"]\n`;
    pgn += `[Result "${result}"]\n`;
    pgn += `[Variant "Chess960"]\n`;
    pgn += `[SetUp "1"]\n`;
    pgn += `[FEN "${this.generateFEN()}"]\n\n`;

    let movesStr = '';
    for (let i = 0; i < this.moveHistory.length; i++) {
      if (i % 2 === 0) {
        movesStr += `${Math.floor(i / 2) + 1}. `;
      }
      movesStr += `${this.moveHistory[i].san} `;
    }

    pgn += movesStr.trim() + (result !== '*' ? ` ${result}` : '');
    return pgn;
  }
}
