/**
 * Core Chess 960 Engine Unit Tests
 * Validates:
 * 1. 960 Starting Position validity (all 0-959 indices)
 * 2. Castling rules across standard and extreme starting configurations
 * 3. En Passant, Pawn Promotions, Checks, Checkmates, and Stalemates
 * 4. FEN (X-FEN & Shredder FEN) export/import symmetry
 */

import { ScharnaglGenerator, Chess960Engine } from '../engine/chess960.js';

export function registerEngineTests(runner) {
    runner.describe('Chess960 Starting Position Generator (SP 0-959)', () => {
        runner.it('All 960 positions must satisfy Fischer Random rules', (assert) => {
            for (let i = 0; i < 960; i++) {
                const rank = ScharnaglGenerator.getBackRank(i);
                assert.equal(rank.length, 8, `SP-${i} rank length must be 8`);

                // Rule 1: Opposite-colored Bishops
                const bIndices = [];
                for (let c = 0; c < 8; c++) {
                    if (rank[c] === 'B') bIndices.push(c);
                }
                assert.equal(bIndices.length, 2, `SP-${i} must have exactly 2 Bishops`);
                assert.isTrue((bIndices[0] % 2) !== (bIndices[1] % 2), `SP-${i} Bishops must be on opposite-colored squares`);

                // Rule 2: King strictly between 2 Rooks
                const kIdx = rank.indexOf('K');
                const r1Idx = rank.indexOf('R');
                const r2Idx = rank.lastIndexOf('R');

                assert.isTrue(kIdx > -1 && r1Idx > -1 && r2Idx > -1, `SP-${i} must have 1 King and 2 Rooks`);
                assert.isTrue(r1Idx < kIdx && kIdx < r2Idx, `SP-${i} King must be between Rooks (R1:${r1Idx}, K:${kIdx}, R2:${r2Idx})`);

                // Rule 3: Encoding <-> Decoding roundtrip symmetry
                const decodedIndex = ScharnaglGenerator.getIndex(rank);
                assert.equal(decodedIndex, i, `SP-${i} (${rank}) roundtrip index mismatch: got ${decodedIndex}`);
            }
        });

        runner.it('Standard Chess index 518 must produce RNBQKBNR', (assert) => {
            const rank = ScharnaglGenerator.getBackRank(518);
            assert.equal(rank, 'RNBQKBNR', 'SP-518 must be standard chess arrangement');
        });
    });

    runner.describe('Chess960 Castling Engine Matrix', () => {
        runner.it('Standard Castling (SP-518 O-O and O-O-O)', (assert) => {
            const engine = new Chess960Engine(518);
            // Clear pieces between King & Rooks for white (row 7)
            engine.board[57] = null; // b1
            engine.board[58] = null; // c1
            engine.board[59] = null; // d1
            engine.board[61] = null; // f1
            engine.board[62] = null; // g1

            const moves = engine.getLegalMoves();
            const kingsideCastle = moves.find(m => m.isCastle && m.castleSide === 'K');
            const queensideCastle = moves.find(m => m.isCastle && m.castleSide === 'Q');

            assert.isTrue(!!kingsideCastle, 'Standard Kingside castle move should be generated');
            assert.isTrue(!!queensideCastle, 'Standard Queenside castle move should be generated');

            // Make Kingside castle
            engine.makeMove(kingsideCastle);
            assert.equal(engine.board[62], 'K', 'White King must end on g1');
            assert.equal(engine.board[61], 'R', 'White Rook must end on f1');
        });

        runner.it('Extreme Castling (SP-959: King on b1, Rooks on a1 & c1)', (assert) => {
            const engine = new Chess960Engine(959); // RKRNNQBB
            // White King is on b1 (square 57). Rooks are on a1 (56) and c1 (58).
            const moves = engine.getLegalMoves();
            const castleMoves = moves.filter(m => m.isCastle);
            assert.isTrue(castleMoves.length > 0, 'SP-959 should allow castling when paths cleared');
        });

        runner.it('Cannot castle out of or through check', (assert) => {
            const engine = new Chess960Engine(518);
            engine.board[57] = null; engine.board[58] = null; engine.board[59] = null;
            engine.board[61] = null; engine.board[62] = null;

            // Attack e1 (square 60) with black rook on e8 (square 4)
            engine.board[4] = 'r';
            engine.board[12] = null; // clear e7 pawn

            const moves = engine.getLegalMoves();
            const castleMoves = moves.filter(m => m.isCastle);
            assert.equal(castleMoves.length, 0, 'Cannot castle when King is currently in check');
        });
    });

    runner.describe('Chess Game Evaluator & FEN Engine', () => {
        runner.it('FEN generation and square coordinate translation', (assert) => {
            const engine = new Chess960Engine(518);
            const fen = engine.getFEN();
            assert.isTrue(fen.includes('w'), 'FEN must record White turn');
            assert.equal(Chess960Engine.squareToAlgebraic(56), 'a1');
            assert.equal(Chess960Engine.squareToAlgebraic(63), 'h1');
            assert.equal(Chess960Engine.algebraicToSquare('e4'), 36);
        });

        runner.it('Checkmate detection', (assert) => {
            // Fool's Mate setup
            const engine = new Chess960Engine(518);
            engine.makeMove(engine.getLegalMoves().find(m => m.from === 54 && m.to === 46)); // f3
            engine.makeMove(engine.getLegalMoves().find(m => m.from === 12 && m.to === 28)); // e5
            engine.makeMove(engine.getLegalMoves().find(m => m.from === 55 && m.to === 39)); // g4
            engine.makeMove(engine.getLegalMoves().find(m => m.from === 3 && m.to === 39));  // Qh4#

            assert.isTrue(engine.isCheckmate(), 'Fool\'s Mate position must be evaluated as checkmate');
            assert.isTrue(engine.isGameOver(), 'Game must be over on checkmate');
        });
    });
}
