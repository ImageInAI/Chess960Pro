/**
 * Main Chess 960 Application Controller & UI Orchestrator
 */

import { Chess960Game, PIECE_NAMES } from './rulesEngine.js';
import { generateChess960Position, getRandomChess960Id, getChess960Id } from './chess960.js';
import { TOP_CHESS960_POSITIONS } from './curatedPositions.js';
import { ChessAI } from './aiEngine.js';
import { sounds } from './audio.js';
import { ChessClock, TIME_PRESETS } from './clock.js';
import { P2PNetwork } from './p2pNetwork.js';
import { BluetoothConnector } from './bluetooth.js';
import { getPieceSvgDataUrl } from './pieces.js';

class Chess960App {
  constructor() {
    this.game = new Chess960Game(518);
    this.ai = new ChessAI(3);
    this.clock = new ChessClock({
      baseSeconds: 300,
      incrementSeconds: 0,
      onTick: (data) => this.updateClockUI(data),
      onTimeout: (loser) => this.handleTimeout(loser)
    });
    this.p2p = null;
    this.bluetooth = null;

    // App State
    this.gameMode = 'bot'; // 'bot', 'pass-and-play', 'local-p2p', 'online-room'
    this.playerColor = 'w'; // 'w', 'b', or 'both'
    this.boardFlipped = false;
    this.selectedSquare = null; // { row, col }
    this.legalMovesForSelected = [];
    this.pendingPromotion = null; // { from, to }
    this.isBotThinking = false;
    this.evalBarEnabled = true;
    this.currentNavIndex = -1; // -1 means live current position

    this.initDOM();
    this.bindEvents();
    this.renderBoard();
    this.renderCuratedPositions();
    this.updateUI();
  }

  initDOM() {
    // Cache UI Elements
    this.dom = {
      boardGrid: document.getElementById('chessBoardGrid'),
      posIdTag: document.getElementById('posIdTag'),
      posString: document.getElementById('posString'),
      posName: document.getElementById('posName'),
      btnRandomPos: document.getElementById('btnRandomPos'),
      btnCuratedPos: document.getElementById('btnCuratedPos'),
      btnSelectPos: document.getElementById('btnSelectPos'),
      btnFlipBoard: document.getElementById('btnFlipBoard'),
      btnNewGame: document.getElementById('btnNewGame'),
      btnGameMode: document.getElementById('btnGameMode'),
      btnUndoMove: document.getElementById('btnUndoMove'),
      btnGetHint: document.getElementById('btnGetHint'),
      btnCopyFen: document.getElementById('btnCopyFen'),
      btnCopyPgn: document.getElementById('btnCopyPgn'),
      
      // Players & Clocks
      whiteClock: document.getElementById('whiteClock'),
      blackClock: document.getElementById('blackClock'),
      whitePlayerName: document.getElementById('whitePlayerName'),
      blackPlayerName: document.getElementById('blackPlayerName'),
      whiteCaptured: document.getElementById('whiteCaptured'),
      blackCaptured: document.getElementById('blackCaptured'),
      whiteAvatar: document.getElementById('whiteAvatar'),
      blackAvatar: document.getElementById('blackAvatar'),
      
      // Move history & Status
      moveHistoryList: document.getElementById('moveHistoryList'),
      gameStatusBanner: document.getElementById('gameStatusBanner'),
      navFirst: document.getElementById('navFirst'),
      navPrev: document.getElementById('navPrev'),
      navNext: document.getElementById('navNext'),
      navLast: document.getElementById('navLast'),

      // Eval Bar
      evalBarWrap: document.getElementById('evalBarWrap'),
      evalWhite: document.getElementById('evalWhite'),
      evalBlack: document.getElementById('evalBlack'),
      evalScore: document.getElementById('evalScore'),

      // Modals
      modeModal: document.getElementById('modeModal'),
      curatedModal: document.getElementById('curatedModal'),
      posPickerModal: document.getElementById('posPickerModal'),
      onlineLobbyModal: document.getElementById('onlineLobbyModal'),
      promotionOverlay: document.getElementById('promotionOverlay'),
      
      // Theme & Audio
      themeSelect: document.getElementById('themeSelect'),
      timePresetSelect: document.getElementById('timePresetSelect'),
      botLevelSelect: document.getElementById('botLevelSelect'),
      btnMute: document.getElementById('btnMute'),
      chatContainer: document.getElementById('chatContainer'),
      chatInput: document.getElementById('chatInput'),
      chatMessages: document.getElementById('chatMessages'),
      toastContainer: document.getElementById('toastContainer')
    };
  }

  bindEvents() {
    // New Game & Controls
    this.dom.btnNewGame.addEventListener('click', () => this.startNewGame());
    this.dom.btnFlipBoard.addEventListener('click', () => this.toggleBoardFlip());
    this.dom.btnRandomPos.addEventListener('click', () => this.rollRandomPosition());
    this.dom.btnCuratedPos.addEventListener('click', () => this.openModal(this.dom.curatedModal));
    this.dom.btnSelectPos.addEventListener('click', () => this.openModal(this.dom.posPickerModal));
    this.dom.btnGameMode.addEventListener('click', () => this.openModal(this.dom.modeModal));
    this.dom.btnGetHint.addEventListener('click', () => this.showHint());
    this.dom.btnUndoMove.addEventListener('click', () => this.undoMove());
    this.dom.btnCopyFen.addEventListener('click', () => this.copyFen());
    this.dom.btnCopyPgn.addEventListener('click', () => this.copyPgn());

    // Navigation buttons
    this.dom.navFirst.addEventListener('click', () => this.navigateToMove(0));
    this.dom.navPrev.addEventListener('click', () => this.navigateDelta(-1));
    this.dom.navNext.addEventListener('click', () => this.navigateDelta(1));
    this.dom.navLast.addEventListener('click', () => this.navigateToMove(-1));

    // Theme & Settings
    this.dom.themeSelect.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-theme', e.target.value);
    });

    this.dom.timePresetSelect.addEventListener('change', (e) => {
      this.clock.setPreset(e.target.value);
      this.updateClockUI({
        whiteTime: this.clock.whiteTime,
        blackTime: this.clock.blackTime,
        activeColor: this.clock.activeColor,
        isUnlimited: this.clock.baseSeconds === 0
      });
    });

    this.dom.botLevelSelect.addEventListener('change', (e) => {
      this.ai.setDifficulty(parseInt(e.target.value));
      this.showToast(`Bot set to ${this.ai.name}`);
    });

    this.dom.btnMute.addEventListener('click', () => {
      sounds.setMuted(!sounds.isMuted);
      this.dom.btnMute.textContent = sounds.isMuted ? '🔇' : '🔊';
    });

    // Promotion piece selectors
    document.querySelectorAll('.promotion-piece-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const piece = btn.getAttribute('data-piece');
        this.executePendingPromotion(piece);
      });
    });

    // Close Modals on click outside or close buttons
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close')) {
          document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        }
      });
    });

    // Prevent closing when clicking modal content
    document.querySelectorAll('.modal-card').forEach(c => {
      c.addEventListener('click', e => e.stopPropagation());
    });

    // Mode Selection Handlers
    document.querySelectorAll('.mode-option-card').forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        this.selectGameMode(mode);
      });
    });

    // Manual 960 ID Input
    const posIdInput = document.getElementById('customPosIdInput');
    const btnLoadCustomPos = document.getElementById('btnLoadCustomPos');
    if (btnLoadCustomPos && posIdInput) {
      btnLoadCustomPos.addEventListener('click', () => {
        const id = parseInt(posIdInput.value);
        if (!isNaN(id) && id >= 0 && id <= 959) {
          this.setChess960Position(id);
          this.closeAllModals();
        } else {
          this.showToast('Please enter a valid Chess960 ID (0 to 959)');
        }
      });
    }

    // Chat input
    if (this.dom.chatInput) {
      this.dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.dom.chatInput.value.trim()) {
          this.sendChatMessage(this.dom.chatInput.value.trim());
          this.dom.chatInput.value = '';
        }
      });
    }

    // Emoji reaction buttons
    document.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        this.sendReaction(emoji);
      });
    });

    // Check URL parameters for online room joins
    this.checkUrlParams();
  }

  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    const pos = urlParams.get('pos');

    if (roomCode) {
      const posId = pos ? parseInt(pos) : 518;
      this.setChess960Position(posId, false);
      this.joinOnlineRoom(roomCode);
    }
  }

  openModal(modal) {
    if (modal) modal.classList.add('open');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  selectGameMode(mode) {
    this.gameMode = mode;
    this.closeAllModals();

    if (mode === 'bot') {
      this.playerColor = 'w';
      this.dom.blackPlayerName.textContent = `Bot (${this.ai.name.split(' ')[0]})`;
      this.dom.whitePlayerName.textContent = 'Player (White)';
      this.startNewGame();
      this.showToast('Mode: vs Game Engine Bot');
    } else if (mode === 'pass-and-play') {
      this.playerColor = 'both';
      this.dom.whitePlayerName.textContent = 'Player 1 (White)';
      this.dom.blackPlayerName.textContent = 'Player 2 (Black)';
      this.startNewGame();
      this.showToast('Mode: Offline Pass & Play');
    } else if (mode === 'local-p2p' || mode === 'online-room') {
      this.openOnlineLobby(mode);
    }
  }

  async openOnlineLobby(mode) {
    this.openModal(this.dom.onlineLobbyModal);
    const hostBtn = document.getElementById('btnCreateRoom');
    const joinBtn = document.getElementById('btnJoinRoom');
    const roomInput = document.getElementById('joinRoomCodeInput');
    const roomStatus = document.getElementById('lobbyStatus');
    const shareLinkWrap = document.getElementById('shareLinkWrap');
    const shareLinkText = document.getElementById('shareLinkText');
    const btnCopyLink = document.getElementById('btnCopyShareLink');

    hostBtn.onclick = async () => {
      hostBtn.disabled = true;
      roomStatus.textContent = 'Creating room on WebRTC mesh...';

      this.p2p = new P2PNetwork({
        onConnected: ({ isHost, peerId }) => {
          this.closeAllModals();
          this.playerColor = 'w';
          this.dom.whitePlayerName.textContent = 'You (Host)';
          this.dom.blackPlayerName.textContent = 'Opponent (Online)';
          this.showToast('Opponent connected! Game started.');
          this.startNewGame();
          // Send initial state
          this.p2p.send('INIT_GAME', {
            positionId: this.game.positionId,
            timePreset: this.dom.timePresetSelect.value
          });
        },
        onData: (data) => this.handleNetworkMessage(data),
        onDisconnected: () => this.showToast('Opponent disconnected.'),
        onError: (err) => {
          roomStatus.textContent = `Error: ${err.message || err}`;
          hostBtn.disabled = false;
        }
      });

      try {
        const roomCode = await this.p2p.createRoom();
        roomStatus.innerHTML = `Room Created! Code: <strong style="color:var(--accent-gold); font-size:1.2rem;">${roomCode}</strong>`;
        const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}&pos=${this.game.positionId}`;
        shareLinkText.value = link;
        shareLinkWrap.style.display = 'block';

        btnCopyLink.onclick = () => {
          navigator.clipboard.writeText(link);
          this.showToast('Invite link copied to clipboard!');
        };
      } catch (e) {
        roomStatus.textContent = `Failed to create room: ${e.message}`;
        hostBtn.disabled = false;
      }
    };

    joinBtn.onclick = async () => {
      const code = roomInput.value.trim();
      if (!code) {
        this.showToast('Please enter a room code.');
        return;
      }
      this.joinOnlineRoom(code);
    };
  }

  async joinOnlineRoom(roomCode) {
    const roomStatus = document.getElementById('lobbyStatus');
    if (roomStatus) roomStatus.textContent = 'Connecting to host...';

    this.p2p = new P2PNetwork({
      onConnected: () => {
        this.closeAllModals();
        this.playerColor = 'b';
        this.boardFlipped = true;
        this.dom.whitePlayerName.textContent = 'Opponent (Host)';
        this.dom.blackPlayerName.textContent = 'You (Black)';
        this.showToast('Connected to Room! Ready to play.');
        this.renderBoard();
      },
      onData: (data) => this.handleNetworkMessage(data),
      onDisconnected: () => this.showToast('Disconnected from room.'),
      onError: (err) => {
        if (roomStatus) roomStatus.textContent = `Error: ${err.message || err}`;
      }
    });

    try {
      await this.p2p.joinRoom(roomCode);
    } catch (e) {
      this.showToast(`Failed to join room: ${e.message}`);
    }
  }

  handleNetworkMessage(data) {
    const { type, payload } = data;
    switch (type) {
      case 'INIT_GAME':
        this.setChess960Position(payload.positionId, false);
        if (payload.timePreset) {
          this.clock.setPreset(payload.timePreset);
        }
        this.startNewGame(false);
        break;

      case 'MOVE':
        this.game.makeMove(payload.move);
        sounds.playMove();
        this.clock.switchTurn(this.game.turn);
        this.updateUI();
        break;

      case 'CHAT':
        this.appendChatMessage(payload.sender, payload.text, false);
        break;

      case 'REACTION':
        this.showFloatingReaction(payload.emoji);
        break;
    }
  }

  sendChatMessage(text) {
    this.appendChatMessage('You', text, true);
    if (this.p2p && this.p2p.connected) {
      this.p2p.send('CHAT', { sender: 'Opponent', text });
    }
  }

  appendChatMessage(sender, text, isSelf) {
    if (!this.dom.chatMessages) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isSelf ? 'self' : 'peer'}`;
    msg.textContent = `${sender}: ${text}`;
    this.dom.chatMessages.appendChild(msg);
    this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
  }

  sendReaction(emoji) {
    this.showFloatingReaction(emoji);
    if (this.p2p && this.p2p.connected) {
      this.p2p.send('REACTION', { emoji });
    }
  }

  showFloatingReaction(emoji) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.fontSize = '3rem';
    el.style.transform = 'translate(-50%, -50%) scale(0.5)';
    el.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '100';
    el.textContent = emoji;
    document.querySelector('.board-stage').appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -120%) scale(1.6)';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 900);
  }

  setChess960Position(id, restart = true) {
    this.game.initGame(id);
    const curated = TOP_CHESS960_POSITIONS.find(p => p.id === id);

    this.dom.posIdTag.textContent = `#${id}`;
    this.dom.posString.textContent = this.game.backRank;
    this.dom.posName.textContent = curated ? curated.name : 'Fischer Random';

    if (restart) {
      this.startNewGame();
    }
  }

  rollRandomPosition() {
    // Slot machine randomizer animation
    let count = 0;
    const btn = this.dom.btnRandomPos;
    btn.disabled = true;

    const interval = setInterval(() => {
      const tempId = getRandomChess960Id();
      this.dom.posIdTag.textContent = `#${tempId}`;
      this.dom.posString.textContent = generateChess960Position(tempId);
      count++;
      if (count >= 12) {
        clearInterval(interval);
        const finalId = getRandomChess960Id();
        this.setChess960Position(finalId);
        btn.disabled = false;
        sounds.playCastle();
        this.showToast(`Position #${finalId} selected!`);
      }
    }, 60);
  }

  renderCuratedPositions() {
    const container = document.getElementById('curatedListContainer');
    if (!container) return;

    container.innerHTML = '';
    TOP_CHESS960_POSITIONS.forEach(pos => {
      const card = document.createElement('div');
      card.className = `curated-card ${this.game.positionId === pos.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="curated-top-row">
          <span class="curated-id">#${pos.id}</span>
          <span class="curated-tag" style="background:${pos.badgeColor}33; color:${pos.badgeColor}; border:1px solid ${pos.badgeColor}66;">${pos.tag}</span>
        </div>
        <div style="font-weight:700; color:#fff; font-size:0.95rem;">${pos.name}</div>
        <div class="curated-pieces-row">
          ${pos.pieces.split('').map(p => `<span class="curated-piece-icon">${p}</span>`).join('')}
        </div>
        <div class="curated-desc">${pos.summary}</div>
      `;

      card.addEventListener('click', () => {
        this.setChess960Position(pos.id);
        this.closeAllModals();
        this.showToast(`Loaded ${pos.name} (#${pos.id})`);
      });

      container.appendChild(card);
    });
  }

  startNewGame(notifyPeer = true) {
    this.game.initGame(this.game.positionId);
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.currentNavIndex = -1;
    this.isBotThinking = false;
    this.clock.reset();

    if (this.p2p && this.p2p.connected && notifyPeer) {
      this.p2p.send('INIT_GAME', {
        positionId: this.game.positionId,
        timePreset: this.dom.timePresetSelect.value
      });
    }

    this.renderBoard();
    this.updateUI();
    sounds.playMove();

    // Start clock on White
    this.clock.start('w');

    // If bot is playing as White
    if (this.gameMode === 'bot' && this.playerColor === 'b') {
      this.triggerBotMove();
    }
  }

  toggleBoardFlip() {
    this.boardFlipped = !this.boardFlipped;
    this.renderBoard();
  }

  renderBoard() {
    this.dom.boardGrid.innerHTML = '';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Display position: either historical or live
    const displayBoard = this.getDisplayBoard();
    const lastMove = this.getLastMove();

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        // Map display coordinates to logical board coordinates (accounting for flip)
        const row = this.boardFlipped ? 7 - displayRow : displayRow;
        const col = this.boardFlipped ? 7 - displayCol : displayCol;

        const square = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        square.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        square.setAttribute('data-row', row);
        square.setAttribute('data-col', col);

        // Coordinates notation
        if ((!this.boardFlipped && row === 7) || (this.boardFlipped && row === 0)) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'square-coord file';
          fileLabel.textContent = files[col];
          square.appendChild(fileLabel);
        }
        if ((!this.boardFlipped && col === 0) || (this.boardFlipped && col === 7)) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'square-coord rank';
          rankLabel.textContent = 8 - row;
          square.appendChild(rankLabel);
        }

        // Selection Highlight
        if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
          square.classList.add('selected');
        }

        // Last Move Highlight
        if (lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col))) {
          square.classList.add('last-move');
        }

        // Check Highlight on active King
        const piece = displayBoard[row][col];
        if (piece && piece.toLowerCase() === 'k') {
          const pColor = piece === piece.toUpperCase() ? 'w' : 'b';
          if (pColor === this.game.turn && this.game.isKingInCheck(pColor)) {
            square.classList.add('in-check');
          }
        }

        // Legal Move Indicators
        const legalMove = this.legalMovesForSelected.find(m => {
          const directMatch = m.to.row === row && m.to.col === col;
          const castleRookMatch = m.isCastling && m.from.row === row && m.rookFromCol === col;
          return directMatch || castleRookMatch;
        });

        if (legalMove) {
          if (legalMove.isCastling) {
            const badge = document.createElement('div');
            badge.className = 'castle-target-badge';
            badge.textContent = legalMove.castleSide === 'k' ? 'O-O' : 'O-O-O';
            square.appendChild(badge);
          }

          if (piece) {
            const ring = document.createElement('div');
            ring.className = 'legal-capture-ring';
            square.appendChild(ring);
          } else {
            const dot = document.createElement('div');
            dot.className = 'legal-dot';
            square.appendChild(dot);
          }
        }

        // Piece rendering
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'chess-piece';
          pieceEl.style.backgroundImage = `url("${getPieceSvgDataUrl(piece)}")`;
          pieceEl.setAttribute('draggable', 'true');

          // Drag and Drop
          pieceEl.addEventListener('dragstart', (e) => this.handleDragStart(e, row, col));
          square.appendChild(pieceEl);
        }

        // Click interaction
        square.addEventListener('click', () => this.handleSquareClick(row, col));
        square.addEventListener('dragover', (e) => e.preventDefault());
        square.addEventListener('drop', (e) => this.handleDrop(e, row, col));

        this.dom.boardGrid.appendChild(square);
      }
    }
  }

  getDisplayBoard() {
    if (this.currentNavIndex === -1 || this.currentNavIndex >= this.game.moveHistory.length) {
      return this.game.board;
    }
    // Replay up to navigation index
    const sim = new Chess960Game(this.game.positionId);
    for (let i = 0; i < this.currentNavIndex; i++) {
      sim.makeMove(this.game.moveHistory[i]);
    }
    return sim.board;
  }

  getLastMove() {
    if (this.currentNavIndex === -1) {
      return this.game.moveHistory[this.game.moveHistory.length - 1] || null;
    }
    return this.game.moveHistory[this.currentNavIndex - 1] || null;
  }

  handleSquareClick(row, col) {
    if (this.game.gameState.isGameOver || this.isBotThinking) return;

    // Check if it's the player's turn based on gameMode
    if (this.gameMode === 'bot' && this.game.turn !== this.playerColor) return;
    if (this.gameMode === 'online-room' && this.game.turn !== this.playerColor) return;

    const clickedPiece = this.game.getPieceAt(row, col);
    const pieceColor = this.game.getPieceColor(clickedPiece);

    // If already selected a square and clicking on a legal target square
    if (this.selectedSquare) {
      const legalMove = this.legalMovesForSelected.find(m => {
        const destMatch = m.to.row === row && m.to.col === col;
        const castleRookMatch = m.isCastling && m.from.row === row && m.rookFromCol === col;
        return destMatch || castleRookMatch;
      });

      if (legalMove) {
        this.attemptMove(legalMove);
        return;
      }
    }

    // Select piece
    if (clickedPiece && pieceColor === this.game.turn) {
      this.selectedSquare = { row, col };
      this.legalMovesForSelected = this.game.getLegalMovesForSquare(row, col);
      this.renderBoard();
    } else {
      // Deselect
      this.selectedSquare = null;
      this.legalMovesForSelected = [];
      this.renderBoard();
    }
  }

  handleDragStart(e, row, col) {
    if (this.game.gameState.isGameOver || this.isBotThinking) {
      e.preventDefault();
      return;
    }
    if (this.gameMode === 'bot' && this.game.turn !== this.playerColor) {
      e.preventDefault();
      return;
    }
    if (this.gameMode === 'online-room' && this.game.turn !== this.playerColor) {
      e.preventDefault();
      return;
    }

    const clickedPiece = this.game.getPieceAt(row, col);
    if (this.game.getPieceColor(clickedPiece) !== this.game.turn) {
      e.preventDefault();
      return;
    }

    this.selectedSquare = { row, col };
    this.legalMovesForSelected = this.game.getLegalMovesForSquare(row, col);
    this.renderBoard();
  }

  handleDrop(e, targetRow, targetCol) {
    e.preventDefault();
    if (!this.selectedSquare) return;

    const legalMove = this.legalMovesForSelected.find(m => {
      const destMatch = m.to.row === targetRow && m.to.col === targetCol;
      const castleRookMatch = m.isCastling && m.from.row === targetRow && m.rookFromCol === targetCol;
      return destMatch || castleRookMatch;
    });

    if (legalMove) {
      this.attemptMove(legalMove);
    } else {
      this.selectedSquare = null;
      this.legalMovesForSelected = [];
      this.renderBoard();
    }
  }

  attemptMove(move) {
    // Check if move is a pawn promotion requiring user piece selection
    if (move.piece.toLowerCase() === 'p' && (move.to.row === 0 || move.to.row === 7) && !move.promotion) {
      this.pendingPromotion = move;
      this.showPromotionDialog(move.piece === 'P' ? 'w' : 'b');
      return;
    }

    this.executeMove(move);
  }

  showPromotionDialog(color) {
    this.dom.promotionOverlay.style.display = 'flex';
  }

  executePendingPromotion(pieceType) {
    this.dom.promotionOverlay.style.display = 'none';
    if (!this.pendingPromotion) return;

    const promoMove = {
      ...this.pendingPromotion,
      promotion: this.game.turn === 'w' ? pieceType.toUpperCase() : pieceType.toLowerCase()
    };
    this.pendingPromotion = null;
    this.executeMove(promoMove);
  }

  executeMove(move) {
    const isCapture = !!move.captured;
    const isCastle = !!move.isCastling;

    const result = this.game.makeMove(move);
    if (!result.success) {
      sounds.playIllegal();
      return;
    }

    // Play synthesized sound
    if (result.isCheck) {
      sounds.playCheck();
    } else if (isCastle) {
      sounds.playCastle();
    } else if (isCapture) {
      sounds.playCapture();
    } else {
      sounds.playMove();
    }

    // Switch clock
    this.clock.switchTurn(this.game.turn);

    // If online P2P match, broadcast move
    if (this.p2p && this.p2p.connected) {
      this.p2p.send('MOVE', { move });
    }

    // Reset selection & navigation
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.currentNavIndex = -1;

    // Optional pass & play auto flip
    if (this.gameMode === 'pass-and-play') {
      this.boardFlipped = this.game.turn === 'b';
    }

    this.renderBoard();
    this.updateUI();

    // Check game over celebrations
    if (this.game.gameState.isGameOver) {
      this.handleGameOver();
      return;
    }

    // Trigger AI move if bot mode
    if (this.gameMode === 'bot' && this.game.turn !== this.playerColor) {
      this.triggerBotMove();
    }
  }

  async triggerBotMove() {
    this.isBotThinking = true;
    this.dom.gameStatusBanner.textContent = `Bot is thinking...`;

    // Dynamic thinking delay based on bot rating
    const thinkTime = Math.min(800, 150 + this.ai.depth * 100);
    await new Promise(r => setTimeout(r, thinkTime));

    const result = await this.ai.findBestMove(this.game);
    this.isBotThinking = false;

    if (result && result.move) {
      this.executeMove(result.move);
    }
  }

  async showHint() {
    if (this.game.gameState.isGameOver || this.isBotThinking) return;
    this.showToast('Evaluating best move...');
    const result = await this.ai.findBestMove(this.game);
    if (result && result.move) {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const fromStr = files[result.move.from.col] + (8 - result.move.from.row);
      const toStr = files[result.move.to.col] + (8 - result.move.to.row);
      this.showToast(`💡 Hint: ${result.move.piece.toUpperCase()} ${fromStr} ➔ ${toStr} (${result.move.san || ''})`, 4500);

      // Temporarily highlight hinted piece
      this.selectedSquare = result.move.from;
      this.legalMovesForSelected = [result.move];
      this.renderBoard();
    }
  }

  undoMove() {
    if (this.game.moveHistory.length === 0) return;
    if (this.p2p && this.p2p.connected) {
      this.showToast('Undo is disabled during live multiplayer matches.');
      return;
    }

    const movesToUndo = this.gameMode === 'bot' ? 2 : 1;
    const targetLength = Math.max(0, this.game.moveHistory.length - movesToUndo);
    const historyBackup = [...this.game.moveHistory];

    this.game.initGame(this.game.positionId);
    for (let i = 0; i < targetLength; i++) {
      this.game.makeMove(historyBackup[i]);
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.renderBoard();
    this.updateUI();
    this.showToast('Move undone');
  }

  handleGameOver() {
    this.clock.stop();
    const { winner, reason } = this.game.gameState;

    if (winner === 'draw') {
      sounds.playDefeat();
      this.showToast(`Game Drawn by ${reason.toUpperCase()}!`);
    } else {
      const isPlayerWin = (this.gameMode === 'bot' && winner === this.playerColor) || (this.gameMode !== 'bot');
      if (isPlayerWin) {
        sounds.playVictory();
        this.triggerConfetti();
        this.showToast(`Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins! 🎉`, 5000);
      } else {
        sounds.playDefeat();
        this.showToast(`Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins.`);
      }
    }
    this.updateUI();
  }

  handleTimeout(loserColor) {
    this.game.gameState.isGameOver = true;
    this.game.gameState.winner = loserColor === 'w' ? 'b' : 'w';
    this.game.gameState.reason = 'timeout';
    sounds.playDefeat();
    this.showToast(`Time out! ${this.game.gameState.winner === 'w' ? 'White' : 'Black'} wins on time!`);
    this.updateUI();
  }

  triggerConfetti() {
    if (typeof window.confetti === 'function') {
      window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  }

  updateClockUI(data) {
    this.dom.whiteClock.textContent = ChessClock.formatTime(data.whiteTime);
    this.dom.blackClock.textContent = ChessClock.formatTime(data.blackTime);

    this.dom.whiteClock.classList.toggle('active', data.activeColor === 'w');
    this.dom.blackClock.classList.toggle('active', data.activeColor === 'b');

    this.dom.whiteClock.classList.toggle('danger', data.whiteTime < 20 && !data.isUnlimited);
    this.dom.blackClock.classList.toggle('danger', data.blackTime < 20 && !data.isUnlimited);

    // Avatar active glow
    this.dom.whiteAvatar.classList.toggle('turn-active', this.game.turn === 'w');
    this.dom.blackAvatar.classList.toggle('turn-active', this.game.turn === 'b');
  }

  updateUI() {
    // Render captured pieces
    this.dom.whiteCaptured.innerHTML = this.game.capturedPieces.w.map(p => `<span style="opacity:0.9">${p}</span>`).join('');
    this.dom.blackCaptured.innerHTML = this.game.capturedPieces.b.map(p => `<span style="opacity:0.9">${p}</span>`).join('');

    // Move History Table
    this.renderMoveHistory();

    // Game Status Banner
    this.renderStatusBanner();

    // Eval Bar
    if (this.evalBarEnabled) {
      this.updateEvalBar();
    }
  }

  renderMoveHistory() {
    this.dom.moveHistoryList.innerHTML = '';
    const moves = this.game.moveHistory;

    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';

      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${Math.floor(i / 2) + 1}.`;
      row.appendChild(num);

      const wCell = document.createElement('span');
      wCell.className = `move-cell ${this.currentNavIndex === i + 1 ? 'active' : ''}`;
      wCell.textContent = moves[i].san;
      wCell.addEventListener('click', () => this.navigateToMove(i + 1));
      row.appendChild(wCell);

      if (moves[i + 1]) {
        const bCell = document.createElement('span');
        bCell.className = `move-cell ${this.currentNavIndex === i + 2 ? 'active' : ''}`;
        bCell.textContent = moves[i + 1].san;
        bCell.addEventListener('click', () => this.navigateToMove(i + 2));
        row.appendChild(bCell);
      }

      this.dom.moveHistoryList.appendChild(row);
    }

    if (this.currentNavIndex === -1) {
      this.dom.moveHistoryList.scrollTop = this.dom.moveHistoryList.scrollHeight;
    }
  }

  renderStatusBanner() {
    const banner = this.dom.gameStatusBanner;
    banner.className = 'game-status-banner';

    if (this.game.gameState.isGameOver) {
      if (this.game.gameState.winner === 'draw') {
        banner.classList.add('draw');
        banner.textContent = `Game Drawn (${this.game.gameState.reason})`;
      } else {
        banner.classList.add('win');
        banner.textContent = `🏆 ${this.game.gameState.winner === 'w' ? 'White' : 'Black'} Won by ${this.game.gameState.reason}!`;
      }
    } else {
      if (this.game.isKingInCheck(this.game.turn)) {
        banner.classList.add('check');
        banner.textContent = `⚠️ Check! ${this.game.turn === 'w' ? 'White' : 'Black'} to move`;
      } else {
        banner.classList.add('ongoing');
        banner.textContent = `${this.game.turn === 'w' ? 'White' : 'Black'} to move`;
      }
    }
  }

  updateEvalBar() {
    const winPct = this.ai.getWinPercentage(this.game);
    const blackPct = 100 - winPct;

    this.dom.evalBlack.style.height = `${blackPct}%`;
    const scoreVal = ((winPct - 50) / 10).toFixed(1);
    this.dom.evalScore.textContent = scoreVal > 0 ? `+${scoreVal}` : scoreVal;

    if (winPct > 50) {
      this.dom.evalScore.className = 'eval-score-tag on-white';
    } else {
      this.dom.evalScore.className = 'eval-score-tag on-black';
    }
  }

  navigateToMove(index) {
    if (index === -1 || index >= this.game.moveHistory.length) {
      this.currentNavIndex = -1;
    } else {
      this.currentNavIndex = Math.max(0, index);
    }
    this.renderBoard();
    this.renderMoveHistory();
  }

  navigateDelta(delta) {
    const current = this.currentNavIndex === -1 ? this.game.moveHistory.length : this.currentNavIndex;
    const next = current + delta;
    this.navigateToMove(next);
  }

  copyFen() {
    const fen = this.game.generateFEN();
    navigator.clipboard.writeText(fen);
    this.showToast('FEN copied to clipboard!');
  }

  copyPgn() {
    const pgn = this.game.generatePGN("Chess 960 Pro", this.dom.whitePlayerName.textContent, this.dom.blackPlayerName.textContent);
    navigator.clipboard.writeText(pgn);
    this.showToast('PGN match notation copied to clipboard!');
  }
}

// Initialize Application once DOM loads
window.addEventListener('DOMContentLoaded', () => {
  window.chessApp = new Chess960App();
});
