/**
 * Realistic & High-Visibility Chess Board UI Component
 * Features high-definition Staunton vector SVG pieces with realistic materials,
 * physical board textures, smooth move indicators, drag-and-drop & click-to-move,
 * check warnings, themes, and Web Audio SFX.
 */

import { Chess960Engine } from '../engine/chess960.js';

class WebAudioSoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playMove() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    playCapture() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
    }

    playCheck() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t); // D5
        osc.frequency.setValueAtTime(880, t + 0.08); // A5

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
    }

    playCastle() {
        if (this.muted) return;
        this.playMove();
        setTimeout(() => this.playMove(), 110);
    }
}

export const soundFx = new WebAudioSoundEngine();

export class BoardUI {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.flipped = false;
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.onMoveSelected = options.onMoveSelected || null;
        this.lastMove = null;
        this.theme = options.theme || 'walnut'; // walnut, green, blue, marble
        this.pieceSVGMap = this.createRealisticStauntonSVGs();
    }

    setTheme(themeName) {
        this.theme = themeName;
        document.documentElement.setAttribute('data-board-theme', themeName);
    }

    createRealisticStauntonSVGs() {
        // High-fidelity Staunton Vector SVGs with subtle specular gradients & shadows
        const whiteGrad = `
            <defs>
                <radialGradient id="wPieceGrad" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="65%" stop-color="#f5efe6"/>
                    <stop offset="100%" stop-color="#ded0be"/>
                </radialGradient>
                <filter id="pieceShadow" x="-20%" y="-20%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="2.5" stdDeviation="1.8" flood-color="#000000" flood-opacity="0.5"/>
                </filter>
            </defs>`;

        const blackGrad = `
            <defs>
                <radialGradient id="bPieceGrad" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="#3b4252"/>
                    <stop offset="60%" stop-color="#222831"/>
                    <stop offset="100%" stop-color="#14181f"/>
                </radialGradient>
            </defs>`;

        const whitePieces = {
            'P': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill="url(#wPieceGrad)" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round"/></g></svg>`,
            'N': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,30 9.65,24 9.65,24 c 0,0 5.6,-1.9 4.85,-8.5 C 13.75,9.5 9.5,8 9.5,8 c 0,0 6,1 9,-2.5 3,-3.5 6,-2.5 6,-2.5 0,0 1.75,2.5 3,3.5 1.25,1 4.5,1 4.5,1 z" fill="url(#wPieceGrad)"/><path d="m 24.55,10.4 c -0.45,0.7 -1.2,1.25 -2.05,1.5" /><path d="m 9.5,25.5 a 0.5,0.5 0 1 1 -1,0 0.5,0.5 0 1 1 1,0 z" fill="#4a3b2c"/><path d="m 15,15.5 a 0.5,1.5 0 1 1 -1,0 0.5,1.5 0 1 1 1,0 z" fill="#4a3b2c" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"/></g></svg>`,
            'B': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="url(#wPieceGrad)" stroke-linecap="butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z"/><path d="M 12,36 C 12,32 14,24 16,21 C 18,18 20,15 20,11 C 20,8.5 21,7.5 22.5,7.5 C 24,7.5 25,8.5 25,11 C 25,15 27,18 29,21 C 31,24 33,32 33,36 L 12,36 z"/><path d="M 22.5,4.5 A 1.5,1.5 0 1 1 22.5,7.5 A 1.5,1.5 0 1 1 22.5,4.5 z"/></g><path d="m 17.5,26 h 10 M 15,30 h 15 M 22.5,10 v 6 M 20,13 h 5" stroke-linejoin="miter"/></g></svg>`,
            'R': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)" fill="url(#wPieceGrad)" fill-rule="evenodd" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" stroke-linecap="butt"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" stroke-linecap="butt"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 14,17 L 14,29.5 L 31,29.5 L 31,17"/><path d="M 14,16.5 L 31,16.5"/><path d="M 11,14 L 34,14"/><path d="M 12,32 L 14,29.5 L 31,29.5 L 33,32"/></g></svg>`,
            'Q': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)" fill="url(#wPieceGrad)" fill-rule="evenodd" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 8.5,14 C 11.5,14 11,18 11,18 C 11,18 15,16 22.5,16 C 30,16 34,18 34,18 C 34,18 33.5,14 36.5,14 C 39.5,14 40,16.5 40,16.5 C 40,16.5 37,27 35.5,31 L 9.5,31 C 8,27 5,16.5 5,16.5 C 5,16.5 5.5,14 8.5,14 z"/><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,14.5 C 38.5,14.5 35,21.5 32.5,19 C 30,16.5 32.5,11 32.5,11 C 32.5,11 28,15 22.5,13.5 C 17,15 12.5,11 12.5,11 C 12.5,11 15,16.5 12.5,19 C 10,21.5 6.5,14.5 6.5,14.5 L 9,26 z"/><path d="M 9,31 L 36,31 L 36,36 L 9,36 L 9,31 z"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g></svg>`,
            'K': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${whiteGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#4a3b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6" stroke-linejoin="miter"/><path d="M 20,8 L 25,8" stroke-linejoin="miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 22.5,12 22.5,12 C 22.5,12 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill="url(#wPieceGrad)"/><path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 33.5,30 36.5,25.5 36.5,25.5 C 36.5,25.5 33,27 28.5,25 C 24,23 23.5,20.5 22.5,20.5 C 21.5,20.5 21,23 16.5,25 C 12,27 8.5,25.5 8.5,25.5 C 8.5,25.5 11.5,30 11.5,37 z" fill="url(#wPieceGrad)"/><path d="M 11.5,30 C 17,27 28,27 33.5,30"/><path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5"/><path d="M 11.5,37 C 17,34 28,34 33.5,37"/></g></svg>`
        };

        const blackPieces = {
            'p': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill="url(#bPieceGrad)" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round"/></g></svg>`,
            'n': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,30 9.65,24 9.65,24 c 0,0 5.6,-1.9 4.85,-8.5 C 13.75,9.5 9.5,8 9.5,8 c 0,0 6,1 9,-2.5 3,-3.5 6,-2.5 6,-2.5 0,0 1.75,2.5 3,3.5 1.25,1 4.5,1 4.5,1 z" fill="url(#bPieceGrad)"/><path d="m 24.55,10.4 c -0.45,0.7 -1.2,1.25 -2.05,1.5" /><path d="m 9.5,25.5 a 0.5,0.5 0 1 1 -1,0 0.5,0.5 0 1 1 1,0 z" fill="#e2e8f0"/><path d="m 15,15.5 a 0.5,1.5 0 1 1 -1,0 0.5,1.5 0 1 1 1,0 z" fill="#e2e8f0" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"/></g></svg>`,
            'b': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><g fill="url(#bPieceGrad)" stroke-linecap="butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z"/><path d="M 12,36 C 12,32 14,24 16,21 C 18,18 20,15 20,11 C 20,8.5 21,7.5 22.5,7.5 C 24,7.5 25,8.5 25,11 C 25,15 27,18 29,21 C 31,24 33,32 33,36 L 12,36 z"/><path d="M 22.5,4.5 A 1.5,1.5 0 1 1 22.5,7.5 A 1.5,1.5 0 1 1 22.5,4.5 z"/></g><path d="m 17.5,26 h 10 M 15,30 h 15 M 22.5,10 v 6 M 20,13 h 5" stroke-linejoin="miter"/></g></svg>`,
            'r': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)" fill="url(#bPieceGrad)" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" stroke-linecap="butt"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" stroke-linecap="butt"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 14,17 L 14,29.5 L 31,29.5 L 31,17"/><path d="M 14,16.5 L 31,16.5"/><path d="M 11,14 L 34,14"/><path d="M 12,32 L 14,29.5 L 31,29.5 L 33,32"/></g></svg>`,
            'q': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)" fill="url(#bPieceGrad)" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M 8.5,14 C 11.5,14 11,18 11,18 C 11,18 15,16 22.5,16 C 30,16 34,18 34,18 C 34,18 33.5,14 36.5,14 C 39.5,14 40,16.5 40,16.5 C 40,16.5 37,27 35.5,31 L 9.5,31 C 8,27 5,16.5 5,16.5 C 5,16.5 5.5,14 8.5,14 z"/><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,14.5 C 38.5,14.5 35,21.5 32.5,19 C 30,16.5 32.5,11 32.5,11 C 32.5,11 28,15 22.5,13.5 C 17,15 12.5,11 12.5,11 C 12.5,11 15,16.5 12.5,19 C 10,21.5 6.5,14.5 6.5,14.5 L 9,26 z"/><path d="M 9,31 L 36,31 L 36,36 L 9,36 L 9,31 z"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g></svg>`,
            'k': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${blackGrad}<g filter="url(#pieceShadow)" fill="none" fill-rule="evenodd" stroke="#e2e8f0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6" stroke-linejoin="miter"/><path d="M 20,8 L 25,8" stroke-linejoin="miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 22.5,12 22.5,12 C 22.5,12 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill="url(#bPieceGrad)"/><path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 33.5,30 36.5,25.5 36.5,25.5 C 36.5,25.5 33,27 28.5,25 C 24,23 23.5,20.5 22.5,20.5 C 21.5,20.5 21,23 16.5,25 C 12,27 8.5,25.5 8.5,25.5 C 8.5,25.5 11.5,30 11.5,37 z" fill="url(#bPieceGrad)"/><path d="M 11.5,30 C 17,27 28,27 33.5,30"/><path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5"/><path d="M 11.5,37 C 17,34 28,34 33.5,37"/></g></svg>`
        };

        return { ...whitePieces, ...blackPieces };
    }

    render(engine) {
        this.container.innerHTML = '';
        const boardGrid = document.createElement('div');
        boardGrid.className = `chessboard-grid ${this.flipped ? 'flipped' : ''}`;

        const inCheckSq = engine.isCheck() ? engine.findKing(engine.turn) : -1;

        for (let idx = 0; idx < 64; idx++) {
            const sq = this.flipped ? 63 - idx : idx;
            const { row, col } = Chess960Engine.toCoords(sq);

            const squareEl = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
            squareEl.dataset.square = sq;

            // Clear corner coordinates
            if (col === (this.flipped ? 7 : 0)) {
                const rankNum = document.createElement('span');
                rankNum.className = 'coord rank-coord';
                rankNum.textContent = 8 - row;
                squareEl.appendChild(rankNum);
            }
            if (row === (this.flipped ? 0 : 7)) {
                const fileLet = document.createElement('span');
                fileLet.className = 'coord file-coord';
                fileLet.textContent = String.fromCharCode(97 + col);
                squareEl.appendChild(fileLet);
            }

            // Piece rendering
            const piece = engine.board[sq];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = 'piece';
                pieceEl.innerHTML = this.pieceSVGMap[piece] || piece;
                pieceEl.draggable = true;

                // Drag & Drop
                pieceEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', sq);
                    this.handleSquareSelect(sq, engine);
                });

                squareEl.appendChild(pieceEl);
            }

            // Drag over / drop listeners
            squareEl.addEventListener('dragover', (e) => e.preventDefault());
            squareEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromSq = parseInt(e.dataTransfer.getData('text/plain'), 10);
                this.executeMoveIfLegal(fromSq, sq, engine);
            });

            // Click listener
            squareEl.addEventListener('click', () => {
                this.handleSquareClick(sq, engine);
            });

            // Selection Highlight
            if (this.selectedSquare === sq) {
                squareEl.classList.add('selected');
            }

            // Last Move Highlight
            if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq || (this.lastMove.isCastle && this.lastMove.rookFrom === sq))) {
                squareEl.classList.add('last-move');
            }

            // In-check King highlight
            if (inCheckSq === sq) {
                squareEl.classList.add('in-check');
            }

            // Target dots for selected piece
            const targetMove = this.legalMovesForSelected.find(m => {
                const destMatch = m.to === sq;
                const isKing = m.piece === 'K';
                const castleDest = isKing && m.isCastle;
                // If King is selected, castling can target either the rook square or standard c/g squares
                const castleTargetMatch = castleDest && (
                    m.rookFrom === sq || 
                    (m.castleSide === 'K' && sq === (m.from < 32 ? 6 : 62)) || 
                    (m.castleSide === 'Q' && sq === (m.from < 32 ? 2 : 58))
                );
                return destMatch || castleTargetMatch;
            });

            if (targetMove) {
                if (targetMove.isCastle) {
                    const badge = document.createElement('div');
                    badge.className = 'castle-badge';
                    badge.textContent = targetMove.castleSide === 'K' ? 'O-O' : 'O-O-O';
                    squareEl.appendChild(badge);
                }

                if (piece) {
                    const ring = document.createElement('div');
                    ring.className = 'capture-ring';
                    squareEl.appendChild(ring);
                } else {
                    const dot = document.createElement('div');
                    dot.className = 'legal-dot';
                    squareEl.appendChild(dot);
                }
            }

            boardGrid.appendChild(squareEl);
        }

        this.container.appendChild(boardGrid);
    }

    handleSquareClick(sq, engine) {
        if (this.selectedSquare !== null) {
            if (this.selectedSquare === sq) {
                this.selectedSquare = null;
                this.legalMovesForSelected = [];
                this.render(engine);
                return;
            }

            const moveExecuted = this.executeMoveIfLegal(this.selectedSquare, sq, engine);
            if (!moveExecuted) {
                this.handleSquareSelect(sq, engine);
            }
        } else {
            this.handleSquareSelect(sq, engine);
        }
    }

    handleSquareSelect(sq, engine) {
        const piece = engine.board[sq];
        if (piece && engine.isCurrentColor(piece)) {
            this.selectedSquare = sq;
            const legalMoves = engine.getLegalMoves();
            this.legalMovesForSelected = legalMoves.filter(m => m.from === sq);
        } else {
            this.selectedSquare = null;
            this.legalMovesForSelected = [];
        }
        this.render(engine);
    }

    executeMoveIfLegal(fromSq, toSq, engine) {
        const legalMoves = engine.getLegalMoves();
        const move = legalMoves.find(m => {
            const fromMatch = m.from === fromSq;
            const toMatch = m.to === toSq;
            const isKing = m.piece === 'K';
            const castleDest = isKing && m.isCastle;
            const castleRookMatch = castleDest && m.rookFrom === toSq;
            const castleKingDestMatch = castleDest && (
                (m.castleSide === 'K' && toSq === (m.from < 32 ? 6 : 62)) || 
                (m.castleSide === 'Q' && toSq === (m.from < 32 ? 2 : 58))
            );
            return fromMatch && (toMatch || castleRookMatch || castleKingDestMatch);
        });

        if (move) {
            this.lastMove = move;
            this.selectedSquare = null;
            this.legalMovesForSelected = [];

            if (move.isCastle) {
                soundFx.playCastle();
            } else if (move.captured) {
                soundFx.playCapture();
            } else {
                soundFx.playMove();
            }

            if (this.onMoveSelected) {
                this.onMoveSelected(move);
            }
            return true;
        }

        return false;
    }

    flipBoard() {
        this.flipped = !this.flipped;
    }
}
