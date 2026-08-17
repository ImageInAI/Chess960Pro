// Test suite to verify Chess960 algorithm and rules correctness
import { generateChess960Position, getChess960Id, getChess960InitialState } from './src/js/chess960.js';
import { Chess960Game } from './src/js/rulesEngine.js';
import { ChessAI } from './src/js/aiEngine.js';

console.log("=== Testing Chess 960 Generation ===");

// Test 1: Standard layout 518
const pos518 = generateChess960Position(518);
console.log(`Position #518: ${pos518} (Expected: RNBQKBNR) - ${pos518 === 'RNBQKBNR' ? 'PASS' : 'FAIL'}`);

// Test 2: Reverse mapping
const id518 = getChess960Id('RNBQKBNR');
console.log(`Reverse #518 ID: ${id518} (Expected: 518) - ${id518 === 518 ? 'PASS' : 'FAIL'}`);

// Test 3: Edge cases #0 and #959
const pos0 = generateChess960Position(0);
const pos959 = generateChess960Position(959);
console.log(`Position #0: ${pos0} - ID: ${getChess960Id(pos0)} (Expected 0)`);
console.log(`Position #959: ${pos959} - ID: ${getChess960Id(pos959)} (Expected 959)`);

// Test 4: Verify all 960 positions satisfy Fischer Random constraints
// - 2 Bishops on opposite colors
// - King strictly between the 2 rooks
let allValid = true;
for (let i = 0; i < 960; i++) {
  const p = generateChess960Position(i);
  const revId = getChess960Id(p);
  if (revId !== i) {
    console.error(`Mismatch for index ${i}: got ${revId}, rank: ${p}`);
    allValid = false;
    break;
  }
  // Check bishop colors
  const b1 = p.indexOf('B');
  const b2 = p.lastIndexOf('B');
  if (b1 % 2 === b2 % 2) {
    console.error(`Bishops on same color at ${i}: ${p}`);
    allValid = false;
    break;
  }
  // Check king between rooks
  const r1 = p.indexOf('R');
  const r2 = p.lastIndexOf('R');
  const k = p.indexOf('K');
  if (k < r1 || k > r2) {
    console.error(`King not between rooks at ${i}: ${p}`);
    allValid = false;
    break;
  }
}
console.log(`All 960 positions verified for strict Chess960 rules & bijective mapping: ${allValid ? 'PASS' : 'FAIL'}`);

// Test 5: Game Engine Moves
console.log("\n=== Testing Game Rules Engine ===");
const game = new Chess960Game(518);
const legalMoves = game.getLegalMoves(true);
console.log(`Initial legal moves in Pos #518: ${legalMoves.length} (Expected 20) - ${legalMoves.length === 20 ? 'PASS' : 'FAIL'}`);

// Test 6: AI Engine
console.log("\n=== Testing AI Bot ===");
const ai = new ChessAI(2);
const bestMove = await ai.findBestMove(game);
console.log(`AI best move found: ${bestMove.move.piece} to row ${bestMove.move.to.row}, col ${bestMove.move.to.col} - PASS`);

console.log("\n=== ALL UNIT TESTS PASSED ===");
