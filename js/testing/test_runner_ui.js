/**
 * Visual Test Runner UI Controller
 * Binds test suites (Engine Unit Tests, UI Tests, Connectivity Tests, Fuzzing Engine)
 * to the graphical dashboard, rendering pass/fail metrics, execution progress, and logs.
 */

import { TestFramework } from './test_framework.js';
import { registerEngineTests } from './engine_tests.js';
import { registerUITests } from './ui_tests.js';
import { registerNetworkTests } from './network_tests.js';
import { FuzzTester } from './fuzz_tester.js';

export class TestRunnerUI {
    constructor(elements) {
        this.els = elements;
        this.framework = new TestFramework();
        this.fuzzTester = new FuzzTester();
        this.setupSuites();
    }

    setupSuites() {
        this.framework = new TestFramework();
        registerEngineTests(this.framework);
        registerUITests(this.framework);
        registerNetworkTests(this.framework);
    }

    bindEvents() {
        if (this.els.runAllBtn) {
            this.els.runAllBtn.onclick = () => this.runAllTests();
        }
        if (this.els.runFuzzBtn) {
            this.els.runFuzzBtn.onclick = () => this.runFuzzingStressTest();
        }
    }

    async runAllTests() {
        this.setupSuites(); // Reset suite states
        this.els.testResultsList.innerHTML = '<div class="test-running-spinner">Running Automated Test Suites...</div>';
        this.els.testProgressBar.style.width = '0%';
        this.els.testStatusSummary.textContent = 'Running tests...';

        let completedCount = 0;
        const totalCount = this.framework.suites.reduce((sum, s) => sum + s.tests.length, 0);

        const results = await this.framework.runAll((progress) => {
            completedCount++;
            const pct = Math.round((completedCount / totalCount) * 100);
            this.els.testProgressBar.style.width = `${pct}%`;
        });

        this.renderResults(results);
    }

    renderResults(results) {
        let html = '';
        results.suites.forEach(suite => {
            const suiteStatusClass = suite.failed === 0 ? 'badge-pass' : 'badge-fail';
            html += `
                <div class="test-suite-card">
                    <div class="test-suite-header">
                        <h4>${suite.name}</h4>
                        <span class="badge ${suiteStatusClass}">${suite.passed}/${suite.tests.length} Passed (${suite.timeMs}ms)</span>
                    </div>
                    <div class="test-case-list">
            `;

            suite.tests.forEach(test => {
                const isPass = test.status === 'PASSED';
                html += `
                    <div class="test-case-item ${isPass ? 'pass' : 'fail'}">
                        <span class="test-icon">${isPass ? '✓' : '✗'}</span>
                        <span class="test-name">${test.name}</span>
                        <span class="test-time">${test.timeMs}ms</span>
                        ${test.error ? `<div class="test-error-log">${test.error}</div>` : ''}
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        this.els.testResultsList.innerHTML = html;
        const overallPass = results.totalFailed === 0;
        this.els.testStatusSummary.innerHTML = `
            <div class="summary-banner ${overallPass ? 'pass' : 'fail'}">
                ${overallPass ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'} 
                (${results.totalPassed}/${results.totalTests} passed in ${results.totalTimeMs}ms)
            </div>
        `;
    }

    async runFuzzingStressTest() {
        this.els.testStatusSummary.innerHTML = '<div class="test-running-spinner">Executing 1,000+ Random Self-Play Fuzz Moves...</div>';
        this.els.testProgressBar.style.width = '0%';

        const res = await this.fuzzTester.runFuzzSuite(10, 100, (prog) => {
            const pct = Math.round((prog.game / prog.totalGames) * 100);
            this.els.testProgressBar.style.width = `${pct}%`;
        });

        this.els.testProgressBar.style.width = '100%';
        const success = res.illegalStatesDetected === 0;
        this.els.testStatusSummary.innerHTML = `
            <div class="summary-banner ${success ? 'pass' : 'fail'}">
                ${success ? '⚡ FUZZING STRESS TEST PASSED' : '⚠️ FUZZING ERRORS DETECTED'}
                <br>Simulated ${res.gamesCompleted} random games (${res.totalMovesPlayed} total moves) in ${res.durationMs}ms with ${res.illegalStatesDetected} errors.
            </div>
        `;
    }
}
