/**
 * SP Explorer & Position Selector UI
 * Provides full control over all 960 starting positions (0 to 959),
 * quick-selection of top famous positions, 3D dice randomizer, and live rank previews.
 */

import { ScharnaglGenerator } from '../engine/chess960.js';

export class SPExplorerUI {
    constructor(modalElement, onPositionSelected) {
        this.modal = modalElement;
        this.onPositionSelected = onPositionSelected;
        this.currentSP = 518;
    }

    render() {
        this.modal.innerHTML = `
            <div class="modal-content glass-card">
                <div class="modal-header">
                    <h3>Chess 960 Position Explorer</h3>
                    <button class="btn-close" id="sp-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="sp-search-bar">
                        <label for="sp-input">Select SP Index (0 - 959):</label>
                        <div class="sp-input-group">
                            <input type="number" id="sp-input" min="0" max="959" value="${this.currentSP}">
                            <button class="btn btn-secondary" id="sp-load-btn">Load Position</button>
                            <button class="btn btn-accent" id="sp-dice-btn">🎲 Random Roll</button>
                        </div>
                    </div>

                    <div class="sp-preview-box">
                        <div class="sp-badge">SP-${this.currentSP}</div>
                        <div class="sp-rank-display" id="sp-rank-display">
                            ${this.renderRankPreview(this.currentSP)}
                        </div>
                    </div>

                    <h4>Famous Tournament Positions</h4>
                    <div class="famous-grid">
                        ${ScharnaglGenerator.FAMOUS_POSITIONS.map(pos => `
                            <div class="famous-card ${pos.id === this.currentSP ? 'active' : ''}" data-sp="${pos.id}">
                                <div class="famous-id">SP-${pos.id}</div>
                                <div class="famous-title">${pos.name}</div>
                                <div class="famous-rank">${pos.rank}</div>
                                <div class="famous-desc">${pos.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="sp-confirm-btn">Confirm Starting Position</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderRankPreview(spIndex) {
        const backRank = ScharnaglGenerator.getBackRank(spIndex);
        return backRank.split('').map(piece => `<span class="piece-pill piece-${piece}">${piece}</span>`).join('');
    }

    bindEvents() {
        const closeBtn = this.modal.querySelector('#sp-close-btn');
        const loadBtn = this.modal.querySelector('#sp-load-btn');
        const diceBtn = this.modal.querySelector('#sp-dice-btn');
        const confirmBtn = this.modal.querySelector('#sp-confirm-btn');
        const input = this.modal.querySelector('#sp-input');
        const rankDisplay = this.modal.querySelector('#sp-rank-display');

        closeBtn.onclick = () => this.hide();

        const updatePreview = (sp) => {
            this.currentSP = sp;
            input.value = sp;
            rankDisplay.innerHTML = this.renderRankPreview(sp);
            this.modal.querySelectorAll('.famous-card').forEach(card => {
                card.classList.toggle('active', parseInt(card.dataset.sp, 10) === sp);
            });
        };

        loadBtn.onclick = () => {
            const val = parseInt(input.value, 10);
            if (val >= 0 && val <= 959) updatePreview(val);
        };

        diceBtn.onclick = () => {
            const randSP = Math.floor(Math.random() * 960);
            updatePreview(randSP);
        };

        this.modal.querySelectorAll('.famous-card').forEach(card => {
            card.onclick = () => {
                const sp = parseInt(card.dataset.sp, 10);
                updatePreview(sp);
            };
        });

        confirmBtn.onclick = () => {
            if (this.onPositionSelected) {
                this.onPositionSelected(this.currentSP);
            }
            this.hide();
        };
    }

    show() {
        this.render();
        this.modal.classList.add('visible');
    }

    hide() {
        this.modal.classList.remove('visible');
    }
}
