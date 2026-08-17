/**
 * Main Game Controller
 * Manages game state, active modes (Bot, P2P Wireless, Online Lobby),
 * configurable chess clocks with standard Chess.com / Lichess presets & increments,
 * realistic board materials/themes, move notation, Game Over modal,
 * and Post-Game Interactive Analysis Mode.
 */

import { Chess960Engine, ScharnaglGenerator } from '../engine/chess960.js';
import { ChessBot } from '../engine/bot.js';
import { OfflineBotAdapter, P2PBluetoothWifiSimulator, OnlineGoogleAuthSimulator } from '../network/network_simulator.js';
import { BoardUI, soundFx } from './board_ui.js';

export const STANDARD_TIME_PRESETS = [
    // Bullet
    { id: '1+0', name: '1 min', cat: 'Bullet', baseMin: 1, incSec: 0 },
    { id: '1+1', name: '1 | 1', cat: 'Bullet', baseMin: 1, incSec: 1 },
    { id: '2+1', name: '2 | 1', cat: 'Bullet', baseMin: 2, incSec: 1 },
    // Blitz
    { id: '3+0', name: '3 min', cat: 'Blitz', baseMin: 3, incSec: 0 },
    { id: '3+2', name: '3 | 2', cat: 'Blitz', baseMin: 3, incSec: 2 },
    { id: '5+0', name: '5 min', cat: 'Blitz', baseMin: 5, incSec: 0 },
    { id: '5+3', name: '5 | 3', cat: 'Blitz', baseMin: 5, incSec: 3 },
    { id: '5+5', name: '5 | 5', cat: 'Blitz', baseMin: 5, incSec: 5 },
    // Rapid
    { id: '10+0', name: '10 min', cat: 'Rapid', baseMin: 10, incSec: 0 },
    { id: '15+10', name: '15 | 10', cat: 'Rapid', baseMin: 15, incSec: 10 },
    { id: '30+0', name: '30 min', cat: 'Rapid', baseMin: 30, incSec: 0 },
    // Classical
    { id: '60+30', name: '60 | 30', cat: 'Classical', baseMin: 60, incSec: 30 },
    // Unlimited
    { id: 'unlimited', name: '∞ No Limit', cat: 'Casual', baseMin: 0, incSec: 0 }
];

export class GameController {
    constructor(elements) {
        this.els = elements;
        this.spIndex = 497; // Default to non-classic 960 position
        this.engine = new Chess960Engine(this.spIndex);
        this.boardUI = new BoardUI(this.els.boardContainer, {
            onMoveSelected: (move) => this.handleUserMove(move)
        });

        this.botEngine = new ChessBot('medium');
        this.botAdapter = new OfflineBotAdapter(this.botEngine);
        this.p2pSimulator = new P2PBluetoothWifiSimulator();
        this.onlineSimulator = new OnlineGoogleAuthSimulator();

        this.gameMode = 'bot'; // 'bot', 'p2p', 'online'
        this.playerColor = 'w';

        // Configurable Time Controls (Standard Lichess/Chess.com)
        this.timeControl = { baseMin: 3, incSec: 0, id: '3+0' };
        this.clockTimes = { w: 180, b: 180 };
        this.clockInterval = null;
        this.isGameActive = false;
        this.startTime = null;

        // Analysis mode state
        this.isAnalysisMode = false;
        this.analysisHistoryIndex = -1; // -1 means live/end of game

        this.setupNetworkListeners();
    }

    setTimePreset(presetId) {
        const preset = STANDARD_TIME_PRESETS.find(p => p.id === presetId);
        if (preset) {
            this.timeControl = { baseMin: preset.baseMin, incSec: preset.incSec, id: preset.id };
            this.startNewGame(this.spIndex);
            this.updateStatusLog(`Time control set to ${preset.name} (${preset.cat})`);
        }
    }

    setCustomTime(baseMinutes, incrementSeconds) {
        this.timeControl = { baseMin: baseMinutes, incSec: incrementSeconds, id: 'custom' };
        this.startNewGame(this.spIndex);
        this.updateStatusLog(`Custom time control set to ${baseMinutes} min + ${incrementSeconds}s`);
    }

    setupNetworkListeners() {
        // P2P events
        this.p2pSimulator.on('state_change', (data) => {
            this.updateStatusLog(`[P2P] ${data.msg}`);
            if (this.els.p2pStatus) this.els.p2pStatus.textContent = data.msg;
        });

        // Online Google Auth events
        this.onlineSimulator.on('auth_change', (data) => {
            if (data.authenticated) {
                this.updateStatusLog(`[Online] Signed in as ${data.user.name} (${data.user.rating})`);
                if (this.els.userProfile) {
                    this.els.userProfile.innerHTML = `<span>${data.user.avatar} ${data.user.name} (${data.user.rating})</span>`;
                }
            } else {
                this.updateStatusLog(`[Online] Signed out.`);
            }
        });

        this.onlineSimulator.on('room_update', (room) => {
            this.updateStatusLog(`[Room ${room.id}] Status: ${room.status}`);
        });

        this.onlineSimulator.on('game_start', (room) => {
            this.updateStatusLog(`[Matchmaking] Opponent ${room.opponent.name} joined! Game starting...`);
            this.startNewGame(room.spIndex);
        });
    }

    startNewGame(spIndex = this.spIndex) {
        this.spIndex = spIndex;
        this.engine.setupPosition(this.spIndex);
        this.boardUI.lastMove = null;
        this.boardUI.selectedSquare = null;
        this.boardUI.legalMovesForSelected = [];
        this.isGameActive = true;
        this.isAnalysisMode = false;
        this.analysisHistoryIndex = -1;
        this.startTime = Date.now();

        if (this.els.analysisNavBar) {
            this.els.analysisNavBar.style.display = 'none';
        }

        this.resetClocks();
        this.startClock();
        this.updateUI();
        soundFx.playMove();
        this.updateStatusLog(`New Chess960 game started (SP-${this.spIndex}: ${ScharnaglGenerator.getBackRank(this.spIndex)})`);
    }

    async handleUserMove(move) {
        if (!this.isGameActive || this.isAnalysisMode) return;

        const success = this.engine.makeMove(move);
        if (!success) return;

        // Apply Fischer Clock Increment
        if (this.timeControl.baseMin > 0 && this.timeControl.incSec > 0) {
            this.clockTimes.w += this.timeControl.incSec;
        }

        this.boardUI.lastMove = move;
        this.updateUI();

        if (this.engine.isGameOver()) {
            this.endGame(this.engine.getGameResult());
            return;
        }

        // Trigger network or bot move if applicable
        if (this.gameMode === 'bot' && this.engine.turn !== this.playerColor) {
            this.updateStatusLog("Engine Bot is thinking...");
            const botMove = await this.botAdapter.requestMove(this.engine);
            if (botMove && this.isGameActive) {
                this.engine.makeMove(botMove);

                // Apply Fischer Clock Increment for Black
                if (this.timeControl.baseMin > 0 && this.timeControl.incSec > 0) {
                    this.clockTimes.b += this.timeControl.incSec;
                }

                this.boardUI.lastMove = botMove;

                if (botMove.isCastle) {
                    soundFx.playCastle();
                } else if (botMove.captured) {
                    soundFx.playCapture();
                } else if (this.engine.isCheck(this.engine.turn)) {
                    soundFx.playCheck();
                } else {
                    soundFx.playMove();
                }

                this.updateUI();
                this.updateStatusLog(`Bot played ${botMove.san || (botMove.piece + '➔' + Chess960Engine.squareToAlgebraic(botMove.to))}`);
                
                if (this.engine.isGameOver()) {
                    this.endGame(this.engine.getGameResult());
                }
            }
        } else if (this.gameMode === 'p2p') {
            await this.p2pSimulator.sendMove({ moveSAN: move.san, fen: this.engine.getFEN() });
        } else if (this.gameMode === 'online') {
            await this.onlineSimulator.sendOnlineMove(move.san, this.engine.getFEN());
        }
    }

    updateUI() {
        if (this.isAnalysisMode && this.analysisHistoryIndex >= 0) {
            // Render historical position up to analysis index
            const sim = new Chess960Engine(this.spIndex);
            for (let i = 0; i < this.analysisHistoryIndex; i++) {
                sim.makeMove(this.engine.moveHistory[i], true);
            }
            this.boardUI.lastMove = this.engine.moveHistory[this.analysisHistoryIndex - 1] || null;
            this.boardUI.render(sim);
            this.updateEvalBar(sim);
        } else {
            this.boardUI.render(this.engine);
            this.updateEvalBar(this.engine);
        }

        this.renderMoveHistory();
        this.renderPositionInfo();
        this.updateClocksDisplay();
    }

    updateEvalBar(engineInstance) {
        if (!this.els.evalBarBlack || !this.els.evalScoreLabel) return;
        const evalScore = this.botEngine.evaluateBoard(engineInstance);
        
        // Convert to percentage (logistic win probability)
        const winProb = 1 / (1 + Math.pow(10, -evalScore / 400));
        const whitePct = Math.round(winProb * 100);
        const blackPct = 100 - whitePct;

        this.els.evalBarBlack.style.height = `${blackPct}%`;

        const cpScore = (evalScore / 100).toFixed(1);
        this.els.evalScoreLabel.textContent = cpScore > 0 ? `+${cpScore}` : cpScore;
        this.els.evalScoreLabel.style.color = whitePct >= 50 ? '#0f172a' : '#f8fafc';
    }

    renderMoveHistory() {
        if (!this.els.moveLog) return;
        const moves = this.engine.moveHistory;
        let html = '';
        for (let i = 0; i < moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const wIdx = i + 1;
            const bIdx = i + 2;
            const whiteMove = moves[i] ? moves[i].san : '';
            const blackMove = moves[i + 1] ? moves[i + 1].san : '';

            const isWActive = this.analysisHistoryIndex === wIdx;
            const isBActive = this.analysisHistoryIndex === bIdx;

            html += `
                <div class="move-row">
                    <span class="move-num">${moveNum}.</span>
                    <span class="move-cell move-w ${isWActive ? 'active' : ''}" data-idx="${wIdx}">${whiteMove}</span>
                    <span class="move-cell move-b ${isBActive ? 'active' : ''}" data-idx="${bIdx}">${blackMove}</span>
                </div>`;
        }
        this.els.moveLog.innerHTML = html;

        // Add click listener to moves to jump to turn in analysis
        this.els.moveLog.querySelectorAll('.move-cell').forEach(cell => {
            cell.onclick = () => {
                const idx = parseInt(cell.dataset.idx, 10);
                if (!isNaN(idx) && idx <= moves.length) {
                    if (!this.isAnalysisMode) this.enterAnalysisMode();
                    this.navigateHistory(idx);
                }
            };
        });

        if (!this.isAnalysisMode) {
            this.els.moveLog.scrollTop = this.els.moveLog.scrollHeight;
        }
    }

    renderPositionInfo() {
        const backRank = ScharnaglGenerator.getBackRank(this.spIndex);
        if (this.els.spTitle) {
            this.els.spTitle.textContent = `SP-${this.spIndex}: ${backRank}`;
        }

        // Render visual rank preview pills
        if (this.els.spMiniLayout) {
            this.els.spMiniLayout.innerHTML = backRank.split('').map((p, idx) => `
                <div class="sp-mini-pill" title="Square ${String.fromCharCode(97 + idx)}1: ${p}">
                    <span class="pill-file">${String.fromCharCode(97 + idx)}</span>
                    <span class="pill-piece">${p}</span>
                </div>
            `).join('');
        }
    }

    resetClocks() {
        clearInterval(this.clockInterval);
        const totalSec = this.timeControl.baseMin * 60;
        this.clockTimes = { w: totalSec, b: totalSec };
        this.updateClocksDisplay();
    }

    startClock() {
        clearInterval(this.clockInterval);
        if (this.timeControl.baseMin === 0) return; // Unlimited mode

        this.clockInterval = setInterval(() => {
            if (!this.isGameActive || this.isAnalysisMode) return;
            const currentTurn = this.engine.turn;
            if (this.clockTimes[currentTurn] > 0) {
                this.clockTimes[currentTurn]--;
                this.updateClocksDisplay();
            } else {
                const winner = currentTurn === 'w' ? 'Black' : 'White';
                this.endGame(`Time Out! ${winner} wins on time.`);
            }
        }, 1000);
    }

    updateClocksDisplay() {
        if (this.timeControl.baseMin === 0) {
            if (this.els.whiteClock) this.els.whiteClock.textContent = '∞';
            if (this.els.blackClock) this.els.blackClock.textContent = '∞';
            return;
        }
        if (this.els.whiteClock) this.els.whiteClock.textContent = this.formatTime(this.clockTimes.w);
        if (this.els.blackClock) this.els.blackClock.textContent = this.formatTime(this.clockTimes.b);
        if (this.els.whiteClockBox) this.els.whiteClockBox.classList.toggle('active-turn', this.engine.turn === 'w' && this.isGameActive);
        if (this.els.blackClockBox) this.els.blackClockBox.classList.toggle('active-turn', this.engine.turn === 'b' && this.isGameActive);
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    endGame(resultMessage) {
        this.isGameActive = false;
        clearInterval(this.clockInterval);
        this.updateStatusLog(`Game Over: ${resultMessage}`);

        // Show Game Over / Victory Modal
        this.showGameOverModal(resultMessage);
    }

    showGameOverModal(resultMessage) {
        if (!this.els.gameOverModal) return;

        const isWhiteWin = resultMessage.includes('White Wins') || resultMessage.includes('White wins');
        const isBlackWin = resultMessage.includes('Black Wins') || resultMessage.includes('Black wins');
        const isDraw = resultMessage.includes('Draw');

        if (isWhiteWin) {
            this.els.gameOverIcon.textContent = '🏆';
            this.els.gameOverTitle.textContent = 'White Won!';
            this.els.gameOverDesc.textContent = resultMessage;
            soundFx.playCheck();
            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            }
        } else if (isBlackWin) {
            this.els.gameOverIcon.textContent = '🤖';
            this.els.gameOverTitle.textContent = 'Black Won!';
            this.els.gameOverDesc.textContent = resultMessage;
            soundFx.playCheck();
        } else {
            this.els.gameOverIcon.textContent = '🤝';
            this.els.gameOverTitle.textContent = 'Draw!';
            this.els.gameOverDesc.textContent = resultMessage;
        }

        if (this.els.statMoves) this.els.statMoves.textContent = this.engine.moveHistory.length;
        if (this.els.statSP) this.els.statSP.textContent = `SP-${this.spIndex}`;
        
        const elapsedSec = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
        if (this.els.statTime) this.els.statTime.textContent = this.formatTime(elapsedSec);

        this.els.gameOverModal.classList.add('visible');
    }

    /* =================== POST-GAME ANALYSIS MODE =================== */

    enterAnalysisMode() {
        this.isAnalysisMode = true;
        this.analysisHistoryIndex = this.engine.moveHistory.length;
        if (this.els.analysisNavBar) {
            this.els.analysisNavBar.style.display = 'flex';
        }
        this.updateAnalysisDisplay();
        this.updateUI();
        this.updateStatusLog('Entered Game Analysis Mode. Use arrows or click moves to explore position.');
    }

    exitAnalysisMode() {
        this.isAnalysisMode = false;
        this.analysisHistoryIndex = -1;
        if (this.els.analysisNavBar) {
            this.els.analysisNavBar.style.display = 'none';
        }
        this.updateUI();
        this.updateStatusLog('Exited Analysis Mode.');
    }

    navigateHistory(index) {
        const maxMoves = this.engine.moveHistory.length;
        if (index === -1 || index >= maxMoves) {
            this.analysisHistoryIndex = maxMoves;
        } else {
            this.analysisHistoryIndex = Math.max(0, index);
        }
        this.updateAnalysisDisplay();
        this.updateUI();
    }

    navigateHistoryDelta(delta) {
        const next = (this.analysisHistoryIndex === -1 ? this.engine.moveHistory.length : this.analysisHistoryIndex) + delta;
        this.navigateHistory(next);
    }

    updateAnalysisDisplay() {
        if (!this.els.analysisMoveEval) return;
        const total = this.engine.moveHistory.length;
        const current = this.analysisHistoryIndex >= 0 ? this.analysisHistoryIndex : total;
        
        let moveLabel = `Move ${current} of ${total}`;
        if (current > 0 && current <= total) {
            const lastM = this.engine.moveHistory[current - 1];
            moveLabel += ` (${lastM.san})`;
        }
        this.els.analysisMoveEval.textContent = moveLabel;
    }

    updateStatusLog(msg) {
        if (!this.els.statusLog) return;
        const entry = document.createElement('div');
        entry.className = 'status-entry';
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        this.els.statusLog.appendChild(entry);
        this.els.statusLog.scrollTop = this.els.statusLog.scrollHeight;
    }
}
