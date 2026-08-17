/**
 * Chess 960 (Fischer Random Chess) Core Engine
 * Implements Scharnagl's index algorithm (0-959), full move generation,
 * Chess960 castling validation, FEN/PGN support, and game state evaluation.
 */

export class ScharnaglGenerator {
    // 10 combinations for placing 2 Knights in 5 remaining slots
    static KNIGHT_PAIRS = [
        [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 2], [1, 3], [1, 4],
        [2, 3], [2, 4],
        [3, 4]
    ];

    /**
     * Converts a Chess960 index (0-959) to an 8-character back rank piece string (uppercase for White)
     * e.g., index 518 -> "RNBQKBNR"
     */
    static getBackRank(spIndex) {
        if (spIndex < 0 || spIndex > 959) {
            throw new Error(`Invalid Chess960 index: ${spIndex}. Must be between 0 and 959.`);
        }

        const rank = new Array(8).fill(null);

        // 1. Dark-squared Bishop (squares 1, 3, 5, 7)
        const b1 = spIndex % 4;
        const b1Square = 2 * b1 + 1;
        rank[b1Square] = 'B';

        // 2. Light-squared Bishop (squares 0, 2, 4, 6)
        const b2 = Math.floor(spIndex / 4) % 4;
        const b2Square = 2 * b2;
        rank[b2Square] = 'B';

        // Helper to get empty slots
        const getEmptySlots = () => {
            const empty = [];
            for (let i = 0; i < 8; i++) {
                if (rank[i] === null) empty.push(i);
            }
            return empty;
        };

        // 3. Queen (placed in the q-th empty slot among 6 remaining slots)
        const q = Math.floor(spIndex / 16) % 6;
        let empty = getEmptySlots();
        rank[empty[q]] = 'Q';

        // 4. Knights (placed in 2 slots among 5 remaining slots)
        const nCombo = Math.floor(spIndex / 96);
        const [n1, n2] = this.KNIGHT_PAIRS[nCombo];
        empty = getEmptySlots();
        rank[empty[n1]] = 'N';
        rank[empty[n2]] = 'N';

        // 5. Rooks and King in remaining 3 empty slots: Left Rook, King, Right Rook
        empty = getEmptySlots();
        rank[empty[0]] = 'R';
        rank[empty[1]] = 'K';
        rank[empty[2]] = 'R';

        return rank.join('');
    }

    /**
     * Finds the Chess960 index (0-959) given an 8-character back rank piece string (e.g. "RNBQKBNR")
     */
    static getIndex(backRankStr) {
        const rank = backRankStr.toUpperCase().split('');
        if (rank.length !== 8) return -1;

        // Dark bishop
        let b1 = -1;
        for (let i = 1; i < 8; i += 2) {
            if (rank[i] === 'B') {
                b1 = Math.floor(i / 2);
                break;
            }
        }

        // Light bishop
        let b2 = -1;
        for (let i = 0; i < 8; i += 2) {
            if (rank[i] === 'B') {
                b2 = Math.floor(i / 2);
                break;
            }
        }

        if (b1 === -1 || b2 === -1) return -1;

        // Mask bishops out to find empty indices
        const temp = [...rank];
        temp[2 * b1 + 1] = null;
        temp[2 * b2] = null;

        const remaining6 = temp.map((val, idx) => ({ val, idx })).filter(item => item.val !== null);

        // Find Queen
        const qIdx = remaining6.findIndex(item => item.val === 'Q');
        if (qIdx === -1) return -1;

        // Mask Queen
        const remaining5 = remaining6.filter((_, idx) => idx !== qIdx);

        // Find Knights
        const kIndices = [];
        remaining5.forEach((item, idx) => {
            if (item.val === 'N') kIndices.push(idx);
        });

        if (kIndices.length !== 2) return -1;

        const nCombo = this.KNIGHT_PAIRS.findIndex(
            pair => pair[0] === kIndices[0] && pair[1] === kIndices[1]
        );

        if (nCombo === -1) return -1;

        // Calculate index
        const index = b1 + 4 * b2 + 16 * qIdx + 96 * nCombo;
        return index;
    }

    /**
     * Top Famous Starting Positions for quick selection
     */
    static FAMOUS_POSITIONS = [
        { id: 497, name: "Dynamic Symmetrical (SP-497)", rank: "BRQBNKNR", desc: "Balanced layout with active wing bishops and central King." },
        { id: 282, name: "Double Wing Bishops (SP-282)", rank: "NRKNBBRQ", desc: "Bishops starting on e1 and f1 with corner Queen." },
        { id: 0,   name: "Ultra-Hypermodern (SP-0)",   rank: "BBQNNRKR", desc: "Both Bishops on a1 and b1 aiming across long diagonals." },
        { id: 959, name: "Inverted Fortress (SP-959)", rank: "RKRNNQBB", desc: "King on b1, Rooks adjacent, Queens and Bishops far right." },
        { id: 746, name: "Corner Queen Ambush (SP-746)", rank: "QNRKRBBN", desc: "Queen starts on a1 for immediate diagonal flank attacks." },
        { id: 169, name: "Central Monarch (SP-169)", rank: "NBNQKRBR", desc: "King in standard center file with Knights on outer files." },
        { id: 400, name: "Fianchetto Master (SP-400)", rank: "BBNNRKQR", desc: "Double fianchetto potential with centralized King and Queen." },
        { id: 821, name: "Wing Knight Outpost (SP-821)", rank: "RNNQBKBR", desc: "Knights on b1 and c1 with central Queen and King." },
        { id: 540, name: "Open Center Aggression (SP-540)", rank: "RNQKNBRB", desc: "King on d1, Queen on c1 with split bishops on flanks." },
        { id: 518, name: "Classical Heritage (SP-518)", rank: "RNBQKBNR", desc: "Traditional standard chess starting position." }
    ];
}

export class Move {
    constructor(from, to, piece, captured = null, flags = {}) {
        this.from = from;       // square index 0..63
        this.to = to;           // square index 0..63
        this.piece = piece;     // 'P', 'N', 'B', 'R', 'Q', 'K' (uppercase)
        this.captured = captured;
        this.isCastle = flags.isCastle || false;
        this.castleSide = flags.castleSide || null; // 'K' or 'Q'
        this.rookFrom = flags.rookFrom ?? null;
        this.rookTo = flags.rookTo ?? null;
        this.isEnPassant = flags.isEnPassant || false;
        this.promotion = flags.promotion || null;
        this.san = flags.san || '';
    }
}

export class Chess960Engine {
    constructor(spIndex = 518) {
        this.spIndex = spIndex;
        this.board = new Array(64).fill(null);
        this.turn = 'w'; // 'w' or 'b'
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.enPassantSquare = null; // square index or null
        
        // Chess960 Castling Rights (File indices 0..7 or null if lost)
        this.castlingRights = {
            w: { kRookFile: null, qRookFile: null },
            b: { kRookFile: null, qRookFile: null }
        };

        // King initial files
        this.wKingFile = null;
        this.bKingFile = null;

        this.moveHistory = [];
        this.positionHistory = []; // FEN string array for 3-fold repetition

        this.setupPosition(spIndex);
    }

    /**
     * Initializes board for given Chess960 position index
     */
    setupPosition(spIndex) {
        this.spIndex = spIndex;
        this.board.fill(null);
        this.turn = 'w';
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.enPassantSquare = null;
        this.moveHistory = [];
        this.positionHistory = [];

        const backRankStr = ScharnaglGenerator.getBackRank(spIndex);

        // Find Rook and King positions for white (rank 7 in 0-indexed board: squares 56..63)
        // Black (rank 0: squares 0..7)
        let wKingCol = -1;
        let wRooks = [];

        for (let col = 0; col < 8; col++) {
            const p = backRankStr[col];
            // Black pieces (row 0: squares 0..7)
            this.board[col] = p.toLowerCase();
            // White pieces (row 7: squares 56..63)
            this.board[56 + col] = p;

            if (p === 'K') wKingCol = col;
            if (p === 'R') wRooks.push(col);
        }

        // Pawns
        for (let col = 0; col < 8; col++) {
            this.board[8 + col] = 'p';   // Rank 7 (row 1)
            this.board[48 + col] = 'P';  // Rank 2 (row 6)
        }

        // Setup Castling initial files:
        // Left rook = Queenside, Right rook = Kingside
        wRooks.sort((a, b) => a - b);

        this.wKingFile = wKingCol;
        this.bKingFile = wKingCol;

        this.castlingRights = {
            w: { qRookFile: wRooks[0], kRookFile: wRooks[1] },
            b: { qRookFile: wRooks[0], kRookFile: wRooks[1] }
        };

        this.recordPosition();
    }

    /**
     * Convert row, col (0..7) to square index (0..63)
     */
    static toSquare(row, col) {
        return row * 8 + col;
    }

    /**
     * Convert square index (0..63) to { row, col }
     */
    static toCoords(square) {
        return { row: Math.floor(square / 8), col: square % 8 };
    }

    /**
     * Convert square index to algebraic notation (e.g. 56 -> 'a1')
     */
    static squareToAlgebraic(square) {
        if (square === null || square === undefined || square < 0 || square > 63) return '-';
        const file = String.fromCharCode(97 + (square % 8));
        const rank = 8 - Math.floor(square / 8);
        return `${file}${rank}`;
    }

    /**
     * Convert algebraic notation (e.g. 'e4') to square index
     */
    static algebraicToSquare(alg) {
        if (!alg || alg.length < 2 || alg === '-') return null;
        const col = alg.charCodeAt(0) - 97;
        const rank = parseInt(alg[1], 10);
        const row = 8 - rank;
        if (col < 0 || col > 7 || row < 0 || row > 7) return null;
        return row * 8 + col;
    }

    /**
     * Gets current board state as FEN string (Shredder FEN format with file letters for castling)
     */
    getFEN() {
        let fen = '';
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row * 8 + col];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += piece;
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (row < 7) fen += '/';
        }

        fen += ` ${this.turn} `;

        // Castling rights string
        let castleStr = '';
        if (this.castlingRights.w.kRookFile !== null) {
            castleStr += String.fromCharCode(65 + this.castlingRights.w.kRookFile);
        }
        if (this.castlingRights.w.qRookFile !== null) {
            castleStr += String.fromCharCode(65 + this.castlingRights.w.qRookFile);
        }
        if (this.castlingRights.b.kRookFile !== null) {
            castleStr += String.fromCharCode(97 + this.castlingRights.b.kRookFile);
        }
        if (this.castlingRights.b.qRookFile !== null) {
            castleStr += String.fromCharCode(97 + this.castlingRights.b.qRookFile);
        }

        fen += (castleStr || '-') + ' ';
        fen += (this.enPassantSquare !== null ? Chess960Engine.squareToAlgebraic(this.enPassantSquare) : '-') + ' ';
        fen += `${this.halfMoveClock} ${this.fullMoveNumber}`;

        return fen;
    }

    recordPosition() {
        // Strip move counters for repetition check
        const baseFEN = this.getFEN().split(' ').slice(0, 4).join(' ');
        this.positionHistory.push(baseFEN);
    }

    isWhite(piece) {
        return piece !== null && piece === piece.toUpperCase();
    }

    isBlack(piece) {
        return piece !== null && piece === piece.toLowerCase();
    }

    isCurrentColor(piece) {
        if (!piece) return false;
        return this.turn === 'w' ? this.isWhite(piece) : this.isBlack(piece);
    }

    findKing(color) {
        const targetKing = color === 'w' ? 'K' : 'k';
        for (let i = 0; i < 64; i++) {
            if (this.board[i] === targetKing) return i;
        }
        return -1;
    }

    /**
     * Check if square `sq` is attacked by opponent of `byColor`
     */
    isSquareAttacked(sq, attackerColor) {
        const { row, col } = Chess960Engine.toCoords(sq);

        // 1. Pawn attacks
        const pawnDir = attackerColor === 'w' ? 1 : -1; // Pawns attack downwards if white, upwards if black
        const pawnPiece = attackerColor === 'w' ? 'P' : 'p';
        const pRow = row + pawnDir;
        if (pRow >= 0 && pRow <= 7) {
            if (col > 0 && this.board[pRow * 8 + (col - 1)] === pawnPiece) return true;
            if (col < 7 && this.board[pRow * 8 + (col + 1)] === pawnPiece) return true;
        }

        // 2. Knight attacks
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        const knightPiece = attackerColor === 'w' ? 'N' : 'n';
        for (const [rOff, cOff] of knightOffsets) {
            const r = row + rOff;
            const c = col + cOff;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                if (this.board[r * 8 + c] === knightPiece) return true;
            }
        }

        // 3. Sliding pieces (Rook, Bishop, Queen)
        const directions = [
            { r: -1, c: 0, type: ['R', 'Q'] }, { r: 1, c: 0, type: ['R', 'Q'] },
            { r: 0, c: -1, type: ['R', 'Q'] }, { r: 0, c: 1, type: ['R', 'Q'] },
            { r: -1, c: -1, type: ['B', 'Q'] }, { r: -1, c: 1, type: ['B', 'Q'] },
            { r: 1, c: -1, type: ['B', 'Q'] }, { r: 1, c: 1, type: ['B', 'Q'] }
        ];

        for (const dir of directions) {
            let r = row + dir.r;
            let c = col + dir.c;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const p = this.board[r * 8 + c];
                if (p) {
                    const pUpper = p.toUpperCase();
                    const isAttacker = attackerColor === 'w' ? this.isWhite(p) : this.isBlack(p);
                    if (isAttacker && dir.type.includes(pUpper)) {
                        return true;
                    }
                    break; // Blocked by any piece
                }
                r += dir.r;
                c += dir.c;
            }
        }

        // 4. King attacks
        const kingPiece = attackerColor === 'w' ? 'K' : 'k';
        for (let rOff = -1; rOff <= 1; rOff++) {
            for (let cOff = -1; cOff <= 1; cOff++) {
                if (rOff === 0 && cOff === 0) continue;
                const r = row + rOff;
                const c = col + cOff;
                if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                    if (this.board[r * 8 + c] === kingPiece) return true;
                }
            }
        }

        return false;
    }

    isCheck(color = this.turn) {
        const kingSq = this.findKing(color);
        if (kingSq === -1) return false;
        const attackerColor = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(kingSq, attackerColor);
    }

    /**
     * Generates all pseudolegal moves, then filters out those that leave king in check
     */
    getLegalMoves() {
        const pseudoMoves = this.generatePseudoLegalMoves();
        const legalMoves = [];

        for (const move of pseudoMoves) {
            if (this.makeMove(move, true)) {
                legalMoves.push(move);
                this.undoMove(move);
            }
        }

        return legalMoves;
    }

    /**
     * Generate all pseudo-legal moves including Chess960 castling
     */
    generatePseudoLegalMoves() {
        const moves = [];
        const isW = this.turn === 'w';

        for (let sq = 0; sq < 64; sq++) {
            const piece = this.board[sq];
            if (!piece || !this.isCurrentColor(piece)) continue;

            const { row, col } = Chess960Engine.toCoords(sq);
            const pUpper = piece.toUpperCase();

            switch (pUpper) {
                case 'P': {
                    const dir = isW ? -1 : 1;
                    const startRow = isW ? 6 : 1;
                    const promoteRow = isW ? 0 : 7;

                    // Forward 1 step
                    const f1Row = row + dir;
                    if (f1Row >= 0 && f1Row <= 7 && !this.board[f1Row * 8 + col]) {
                        const f1Sq = f1Row * 8 + col;
                        if (f1Row === promoteRow) {
                            ['Q', 'R', 'B', 'N'].forEach(prom => {
                                moves.push(new Move(sq, f1Sq, 'P', null, { promotion: prom }));
                            });
                        } else {
                            moves.push(new Move(sq, f1Sq, 'P'));
                        }

                        // Forward 2 steps
                        const f2Row = row + 2 * dir;
                        if (row === startRow && !this.board[f2Row * 8 + col]) {
                            moves.push(new Move(sq, f2Row * 8 + col, 'P'));
                        }
                    }

                    // Captures (Left & Right)
                    for (const cCol of [col - 1, col + 1]) {
                        if (cCol >= 0 && cCol <= 7 && f1Row >= 0 && f1Row <= 7) {
                            const capSq = f1Row * 8 + cCol;
                            const target = this.board[capSq];
                            if (target && (isW ? this.isBlack(target) : this.isWhite(target))) {
                                if (f1Row === promoteRow) {
                                    ['Q', 'R', 'B', 'N'].forEach(prom => {
                                        moves.push(new Move(sq, capSq, 'P', target, { promotion: prom }));
                                    });
                                } else {
                                    moves.push(new Move(sq, capSq, 'P', target));
                                }
                            } else if (capSq === this.enPassantSquare) {
                                // En passant capture
                                const epCapSq = row * 8 + cCol;
                                const epTarget = this.board[epCapSq];
                                moves.push(new Move(sq, capSq, 'P', epTarget, { isEnPassant: true }));
                            }
                        }
                    }
                    break;
                }

                case 'N': {
                    const offsets = [
                        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                        [1, -2], [1, 2], [2, -1], [2, 1]
                    ];
                    for (const [rO, cO] of offsets) {
                        const r = row + rO;
                        const c = col + cO;
                        if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                            const targetSq = r * 8 + c;
                            const target = this.board[targetSq];
                            if (!target || (isW ? this.isBlack(target) : this.isWhite(target))) {
                                moves.push(new Move(sq, targetSq, 'N', target));
                            }
                        }
                    }
                    break;
                }

                case 'B':
                case 'R':
                case 'Q': {
                    const dirs = [];
                    if (pUpper === 'B' || pUpper === 'Q') {
                        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
                    }
                    if (pUpper === 'R' || pUpper === 'Q') {
                        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
                    }

                    for (const [rO, cO] of dirs) {
                        let r = row + rO;
                        let c = col + cO;
                        while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                            const targetSq = r * 8 + c;
                            const target = this.board[targetSq];
                            if (!target) {
                                moves.push(new Move(sq, targetSq, pUpper));
                            } else {
                                if (isW ? this.isBlack(target) : this.isWhite(target)) {
                                    moves.push(new Move(sq, targetSq, pUpper, target));
                                }
                                break;
                            }
                            r += rO;
                            c += cO;
                        }
                    }
                    break;
                }

                case 'K': {
                    // Standard 1-square moves
                    for (let rO = -1; rO <= 1; rO++) {
                        for (let cO = -1; cO <= 1; cO++) {
                            if (rO === 0 && cO === 0) continue;
                            const r = row + rO;
                            const c = col + cO;
                            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                                const targetSq = r * 8 + c;
                                const target = this.board[targetSq];
                                if (!target || (isW ? this.isBlack(target) : this.isWhite(target))) {
                                    moves.push(new Move(sq, targetSq, 'K', target));
                                }
                            }
                        }
                    }

                    // Chess 960 Castling Moves
                    this.generateCastlingMoves(sq, moves);
                    break;
                }
            }
        }

        return moves;
    }

    /**
     * Generates Chess960 castling moves for current King position `kingSq`
     */
    generateCastlingMoves(kingSq, moves) {
        const isW = this.turn === 'w';
        const rankRow = isW ? 7 : 0;
        const kingFile = isW ? this.wKingFile : this.bKingFile;
        const attackerColor = isW ? 'b' : 'w';

        // Cannot castle out of check
        if (this.isSquareAttacked(kingSq, attackerColor)) return;

        const rights = isW ? this.castlingRights.w : this.castlingRights.b;

        // Try Kingside (O-O) and Queenside (O-O-O)
        const castleTypes = [
            { type: 'K', rookFile: rights.kRookFile, targetKingFile: 6, targetRookFile: 5 }, // g1/g8 & f1/f8
            { type: 'Q', rookFile: rights.qRookFile, targetKingFile: 2, targetRookFile: 3 }  // c1/c8 & d1/d8
        ];

        for (const castle of castleTypes) {
            if (castle.rookFile === null) continue;

            const rookSq = rankRow * 8 + castle.rookFile;
            const targetKingSq = rankRow * 8 + castle.targetKingFile;
            const targetRookSq = rankRow * 8 + castle.targetRookFile;

            // 1. Path clearance check
            // All squares between King & targetKing, and Rook & targetRook must be empty (except King & Rook themselves)
            let pathClear = true;

            const minCol = Math.min(kingFile, castle.rookFile, castle.targetKingFile, castle.targetRookFile);
            const maxCol = Math.max(kingFile, castle.rookFile, castle.targetKingFile, castle.targetRookFile);

            for (let c = minCol; c <= maxCol; c++) {
                const sq = rankRow * 8 + c;
                if (sq === kingSq || sq === rookSq) continue;
                if (this.board[sq] !== null) {
                    pathClear = false;
                    break;
                }
            }

            if (!pathClear) continue;

            // 2. Safety check: King's travel path (including start and destination) must not be attacked
            let kingPathSafe = true;
            const kStartCol = Math.min(kingFile, castle.targetKingFile);
            const kEndCol = Math.max(kingFile, castle.targetKingFile);

            for (let c = kStartCol; c <= kEndCol; c++) {
                const sq = rankRow * 8 + c;
                if (this.isSquareAttacked(sq, attackerColor)) {
                    kingPathSafe = false;
                    break;
                }
            }

            if (!kingPathSafe) continue;

            // Legal Chess960 castling move found!
            moves.push(new Move(kingSq, rookSq, 'K', null, {
                isCastle: true,
                castleSide: castle.type,
                rookFrom: rookSq,
                rookTo: targetRookSq
            }));
        }
    }

    /**
     * Executes a move on the board. Returns false if move puts own king in check.
     */
    makeMove(move, isTest = false) {
        const isW = this.turn === 'w';
        const kingPiece = isW ? 'K' : 'k';
        const rookPiece = isW ? 'R' : 'r';

        // Save rollback snapshot
        const snapshot = {
            board: [...this.board],
            turn: this.turn,
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            enPassantSquare: this.enPassantSquare,
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights))
        };
        move._snapshot = snapshot;

        // Perform move on board
        if (move.isCastle) {
            const rankRow = isW ? 7 : 0;
            const targetKingSq = rankRow * 8 + (move.castleSide === 'K' ? 6 : 2);
            const targetRookSq = rankRow * 8 + (move.castleSide === 'K' ? 5 : 3);

            // Clear original King & Rook positions
            this.board[move.from] = null;
            this.board[move.rookFrom] = null;

            // Place King & Rook on destination squares
            this.board[targetKingSq] = kingPiece;
            this.board[targetRookSq] = rookPiece;

            // Lose castling rights for this color
            if (isW) {
                this.castlingRights.w.kRookFile = null;
                this.castlingRights.w.qRookFile = null;
            } else {
                this.castlingRights.b.kRookFile = null;
                this.castlingRights.b.qRookFile = null;
            }
        } else {
            // Normal move or promotion or en-passant
            const piece = this.board[move.from];

            this.board[move.from] = null;

            if (move.isEnPassant) {
                const epCapRow = isW ? move.to + 8 : move.to - 8;
                this.board[epCapRow] = null;
            }

            if (move.promotion) {
                const promPiece = isW ? move.promotion.toUpperCase() : move.promotion.toLowerCase();
                this.board[move.to] = promPiece;
            } else {
                this.board[move.to] = piece;
            }

            // Update Castling Rights
            if (piece === 'K') {
                this.castlingRights.w.kRookFile = null;
                this.castlingRights.w.qRookFile = null;
            } else if (piece === 'k') {
                this.castlingRights.b.kRookFile = null;
                this.castlingRights.b.qRookFile = null;
            }

            // Rook moves or captured
            if (piece === 'R' || move.from === 56 + this.castlingRights.w.qRookFile) {
                if (move.from % 8 === this.castlingRights.w.qRookFile) this.castlingRights.w.qRookFile = null;
                if (move.from % 8 === this.castlingRights.w.kRookFile) this.castlingRights.w.kRookFile = null;
            }
            if (piece === 'r' || move.from === this.castlingRights.b.qRookFile) {
                if (move.from % 8 === this.castlingRights.b.qRookFile) this.castlingRights.b.qRookFile = null;
                if (move.from % 8 === this.castlingRights.b.kRookFile) this.castlingRights.b.kRookFile = null;
            }
            // Capture of a Rook on its original square
            if (move.to === 56 + this.castlingRights.w.qRookFile) this.castlingRights.w.qRookFile = null;
            if (move.to === 56 + this.castlingRights.w.kRookFile) this.castlingRights.w.kRookFile = null;
            if (move.to === this.castlingRights.b.qRookFile) this.castlingRights.b.qRookFile = null;
            if (move.to === this.castlingRights.b.kRookFile) this.castlingRights.b.kRookFile = null;
        }

        // Set or clear En Passant square
        if (move.piece === 'P' && Math.abs(move.to - move.from) === 16) {
            this.enPassantSquare = isW ? move.from - 8 : move.from + 8;
        } else {
            this.enPassantSquare = null;
        }

        // Check if own king is in check after move
        if (this.isCheck(this.turn)) {
            // Revert state
            this.undoMove(move);
            return false;
        }

        // Update half-move clock and full-move number
        if (move.piece === 'P' || move.captured || move.isEnPassant) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        if (!isW) {
            this.fullMoveNumber++;
        }

        // Switch turn
        this.turn = isW ? 'b' : 'w';

        if (!isTest) {
            // Generate SAN notation
            move.san = this.generateSAN(move);
            this.moveHistory.push(move);
            this.recordPosition();
        }

        return true;
    }

    /**
     * Undoes a move using snapshot
     */
    undoMove(move) {
        if (!move._snapshot) return;
        const snap = move._snapshot;
        this.board = [...snap.board];
        this.turn = snap.turn;
        this.halfMoveClock = snap.halfMoveClock;
        this.fullMoveNumber = snap.fullMoveNumber;
        this.enPassantSquare = snap.enPassantSquare;
        this.castlingRights = JSON.parse(JSON.stringify(snap.castlingRights));
    }

    /**
     * Generates SAN string for move
     */
    generateSAN(move) {
        if (move.isCastle) {
            return move.castleSide === 'K' ? 'O-O' : 'O-O-O';
        }

        let san = '';
        if (move.piece !== 'P') {
            san += move.piece;
            // Add disambiguation if needed
            san += Chess960Engine.squareToAlgebraic(move.from)[0];
        }

        if (move.captured || move.isEnPassant) {
            if (move.piece === 'P') san += Chess960Engine.squareToAlgebraic(move.from)[0];
            san += 'x';
        }

        san += Chess960Engine.squareToAlgebraic(move.to);

        if (move.promotion) {
            san += '=' + move.promotion.toUpperCase();
        }

        if (this.isCheck(this.turn)) {
            const hasLegal = this.getLegalMoves().length > 0;
            san += hasLegal ? '+' : '#';
        }

        return san;
    }

    /**
     * Game status evaluations
     */
    isCheckmate() {
        return this.isCheck(this.turn) && this.getLegalMoves().length === 0;
    }

    isStalemate() {
        return !this.isCheck(this.turn) && this.getLegalMoves().length === 0;
    }

    isDrawBy50Moves() {
        return this.halfMoveClock >= 100; // 50 full moves
    }

    isDrawByRepetition() {
        if (this.positionHistory.length < 3) return false;
        const currentPos = this.positionHistory[this.positionHistory.length - 1];
        let count = 0;
        for (const pos of this.positionHistory) {
            if (pos === currentPos) count++;
        }
        return count >= 3;
    }

    isGameOver() {
        return this.isCheckmate() || this.isStalemate() || this.isDrawBy50Moves() || this.isDrawByRepetition();
    }

    getGameResult() {
        if (this.isCheckmate()) {
            return this.turn === 'w' ? '0-1 (Black Wins by Checkmate)' : '1-0 (White Wins by Checkmate)';
        }
        if (this.isStalemate()) return '1/2-1/2 (Draw by Stalemate)';
        if (this.isDrawBy50Moves()) return '1/2-1/2 (Draw by 50-Move Rule)';
        if (this.isDrawByRepetition()) return '1/2-1/2 (Draw by 3-Fold Repetition)';
        return 'Game in Progress';
    }

    generatePGN() {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
        const headers = [
            `[Event "Chess960 Pro Match"]`,
            `[Site "Local"]`,
            `[Date "${dateStr}"]`,
            `[Round "1"]`,
            `[White "Player"]`,
            `[Black "Engine Bot"]`,
            `[Result "${this.isGameOver() ? (this.isCheckmate() ? (this.turn === 'w' ? '0-1' : '1-0') : '1/2-1/2') : '*' }"]`,
            `[Variant "Chess960"]`,
            `[SetUp "1"]`,
            `[FEN "${this.getInitialFEN()}"]`,
            `[FRCPosition "${this.spIndex}"]`,
            ``
        ];

        let moveText = '';
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const w = this.moveHistory[i] ? this.moveHistory[i].san : '';
            const b = this.moveHistory[i + 1] ? this.moveHistory[i + 1].san : '';
            moveText += `${moveNum}. ${w} ${b} `.trim() + ' ';
        }

        const resultTag = this.isGameOver() ? (this.isCheckmate() ? (this.turn === 'w' ? '0-1' : '1-0') : '1/2-1/2') : '*';
        return headers.join('\n') + '\n' + moveText.trim() + ' ' + resultTag;
    }

    getInitialFEN() {
        const backRank = ScharnaglGenerator.getBackRank(this.spIndex);
        return `${backRank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${backRank} w KQkq - 0 1`;
    }
}
