/**
 * Automated UI Component Test Suite
 * Tests DOM rendering of 8x8 chessboard, piece SVG elements, selection highlights,
 * modal dialogs, and event listeners.
 */

import { BoardUI } from '../ui/board_ui.js';
import { Chess960Engine } from '../engine/chess960.js';
import { SPExplorerUI } from '../ui/sp_explorer_ui.js';

export function registerUITests(runner) {
    runner.describe('UI Board Rendering & Interactions', () => {
        runner.it('Renders 64 squares with correct light/dark theme classes', (assert) => {
            const container = document.createElement('div');
            const engine = new Chess960Engine(518);
            const boardUI = new BoardUI(container);

            boardUI.render(engine);

            const squares = container.querySelectorAll('.square');
            assert.equal(squares.length, 64, 'Chessboard must render exactly 64 squares');

            const lightSquares = container.querySelectorAll('.square.light');
            const darkSquares = container.querySelectorAll('.square.dark');
            assert.equal(lightSquares.length, 32, 'Must have 32 light squares');
            assert.equal(darkSquares.length, 32, 'Must have 32 dark squares');
        });

        runner.it('Renders piece SVG icons on starting squares', (assert) => {
            const container = document.createElement('div');
            const engine = new Chess960Engine(518);
            const boardUI = new BoardUI(container);

            boardUI.render(engine);

            const pieceElements = container.querySelectorAll('.piece');
            assert.equal(pieceElements.length, 32, 'Must render 32 total piece SVG elements');
        });

        runner.it('Highlights selected square and legal target dots on click', (assert) => {
            const container = document.createElement('div');
            const engine = new Chess960Engine(518);
            const boardUI = new BoardUI(container);

            boardUI.render(engine);

            // Click White Pawn on e2 (square 52)
            boardUI.handleSquareClick(52, engine);

            const selectedSq = container.querySelector('.square.selected');
            assert.isTrue(!!selectedSq, 'Selected square must have .selected class');

            const targetDots = container.querySelectorAll('.legal-dot, .capture-ring');
            assert.isTrue(targetDots.length > 0, 'Legal move target indicators must be rendered');
        });

        runner.it('Flips board orientation toggle correctly', (assert) => {
            const container = document.createElement('div');
            const engine = new Chess960Engine(518);
            const boardUI = new BoardUI(container);

            assert.isFalse(boardUI.flipped, 'Initial board orientation is unflipped');
            boardUI.flipBoard();
            assert.isTrue(boardUI.flipped, 'Board orientation becomes flipped');
        });
    });

    runner.describe('SP Explorer Modal Component', () => {
        runner.it('Loads modal DOM and switches starting position preview', (assert) => {
            const modal = document.createElement('div');
            let selectedSP = null;
            const explorer = new SPExplorerUI(modal, (sp) => { selectedSP = sp; });

            explorer.show();

            const input = modal.querySelector('#sp-input');
            const rankDisplay = modal.querySelector('#sp-rank-display');

            assert.isTrue(modal.classList.contains('visible'), 'Modal must be visible');
            assert.isTrue(!!input && !!rankDisplay, 'Modal input and rank elements must exist');

            // Select SP 959
            const card959 = modal.querySelector('.famous-card[data-sp="959"]');
            if (card959) card959.click();

            const confirmBtn = modal.querySelector('#sp-confirm-btn');
            confirmBtn.click();

            assert.equal(selectedSP, 959, 'Selected SP must be confirmed as 959');
        });
    });
}
