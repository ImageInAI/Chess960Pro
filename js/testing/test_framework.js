/**
 * Micro Test Framework for Chess 960 Test Engine
 * Provides describe(), it(), assert(), expect(), async execution, timing metrics,
 * and structured test result collection.
 */

export class TestFramework {
    constructor() {
        this.suites = [];
        this.currentSuite = null;
        this.onTestComplete = null;
    }

    describe(name, fn) {
        const suite = { name, tests: [], passed: 0, failed: 0, timeMs: 0 };
        this.suites.push(suite);
        this.currentSuite = suite;
        fn();
    }

    it(name, fn) {
        if (!this.currentSuite) {
            throw new Error("it() must be called inside a describe() suite.");
        }
        this.currentSuite.tests.push({ name, fn, status: 'PENDING', error: null, timeMs: 0 });
    }

    async runAll(onProgress = null) {
        let totalPassed = 0;
        let totalFailed = 0;
        const startTime = performance.now();

        for (const suite of this.suites) {
            suite.passed = 0;
            suite.failed = 0;
            const suiteStart = performance.now();

            for (const test of suite.tests) {
                const tStart = performance.now();
                try {
                    await test.fn(this.createAssertions());
                    test.status = 'PASSED';
                    suite.passed++;
                    totalPassed++;
                } catch (err) {
                    test.status = 'FAILED';
                    test.error = err.message || String(err);
                    suite.failed++;
                    totalFailed++;
                }
                test.timeMs = Math.round(performance.now() - tStart);

                if (onProgress) {
                    onProgress({ suite: suite.name, test: test.name, status: test.status, error: test.error });
                }
            }
            suite.timeMs = Math.round(performance.now() - suiteStart);
        }

        const totalTimeMs = Math.round(performance.now() - startTime);

        return {
            suites: this.suites,
            totalPassed,
            totalFailed,
            totalTests: totalPassed + totalFailed,
            totalTimeMs
        };
    }

    createAssertions() {
        return {
            isTrue(val, msg = 'Expected true') {
                if (val !== true) throw new Error(`${msg} (got ${val})`);
            },
            isFalse(val, msg = 'Expected false') {
                if (val !== false) throw new Error(`${msg} (got ${val})`);
            },
            equal(actual, expected, msg = 'Values not equal') {
                if (actual !== expected) throw new Error(`${msg}: Expected '${expected}', got '${actual}'`);
            },
            notEqual(actual, expected, msg = 'Values should not be equal') {
                if (actual === expected) throw new Error(`${msg}: Got '${actual}'`);
            },
            throws(fn, msg = 'Expected function to throw error') {
                let threw = false;
                try { fn(); } catch (e) { threw = true; }
                if (!threw) throw new Error(msg);
            }
        };
    }
}
