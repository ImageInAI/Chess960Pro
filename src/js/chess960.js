/**
 * Chess 960 (Fischer Random Chess) Generator & Scharnagl Indexer
 * Fully implements standard 0-959 Scharnagl algorithm & reverse indexer.
 */

const KNIGHT_COMBOS = [
  [0, 1], // 0
  [0, 2], // 1
  [0, 3], // 2
  [0, 4], // 3
  [1, 2], // 4
  [1, 3], // 5
  [1, 4], // 6
  [2, 3], // 7
  [2, 4], // 8
  [3, 4]  // 9
];

/**
 * Generate 8-character back rank string from 960 index (0 - 959).
 * E.g. generateChess960Position(518) -> "RNBQKBNR"
 * @param {number} id - Position ID between 0 and 959
 * @returns {string} 8-character string of uppercase pieces (e.g. "RNBQKBNR")
 */
export function generateChess960Position(id) {
  if (id < 0 || id > 959 || !Number.isInteger(id)) {
    throw new Error(`Invalid Chess960 ID: ${id}. Must be an integer between 0 and 959.`);
  }

  const row = new Array(8).fill(null);

  // 1. Light-squared bishop on [1, 3, 5, 7]
  const b1 = id % 4;
  row[2 * b1 + 1] = 'B';
  const n1 = Math.floor(id / 4);

  // 2. Dark-squared bishop on [0, 2, 4, 6]
  const b2 = n1 % 4;
  row[2 * b2] = 'B';
  const n2 = Math.floor(n1 / 4);

  // 3. Queen on the q-th empty square
  const q = n2 % 6;
  let emptyIndices = [];
  for (let i = 0; i < 8; i++) {
    if (row[i] === null) emptyIndices.push(i);
  }
  row[emptyIndices[q]] = 'Q';
  const n3 = Math.floor(n2 / 6);

  // 4. Knights on two remaining empty squares according to combination index n3 (0-9)
  const knightPair = KNIGHT_COMBOS[n3];
  emptyIndices = [];
  for (let i = 0; i < 8; i++) {
    if (row[i] === null) emptyIndices.push(i);
  }
  row[emptyIndices[knightPair[0]]] = 'N';
  row[emptyIndices[knightPair[1]]] = 'N';

  // 5. Remaining 3 empty squares get R, K, R (King between Rooks)
  emptyIndices = [];
  for (let i = 0; i < 8; i++) {
    if (row[i] === null) emptyIndices.push(i);
  }
  row[emptyIndices[0]] = 'R';
  row[emptyIndices[1]] = 'K';
  row[emptyIndices[2]] = 'R';

  return row.join('');
}

/**
 * Reverse calculate the 960 position ID from an 8-character rank string.
 * E.g. getChess960Id("RNBQKBNR") -> 518
 * @param {string} pieces - 8-character uppercase string
 * @returns {number} Position ID (0 - 959)
 */
export function getChess960Id(pieces) {
  if (typeof pieces !== 'string' || pieces.length !== 8) {
    throw new Error('Pieces must be an 8-character string');
  }

  const p = pieces.split('');
  
  // Find light bishop (index 1, 3, 5, 7)
  let b1 = -1;
  for (let i = 1; i < 8; i += 2) {
    if (p[i] === 'B') {
      b1 = Math.floor(i / 2);
      break;
    }
  }

  // Find dark bishop (index 0, 2, 4, 6)
  let b2 = -1;
  for (let i = 0; i < 8; i += 2) {
    if (p[i] === 'B') {
      b2 = Math.floor(i / 2);
      break;
    }
  }

  // Find Queen index among remaining non-bishop squares
  const nonBishopSquares = [];
  for (let i = 0; i < 8; i++) {
    if (i !== b1 * 2 + 1 && i !== b2 * 2) {
      nonBishopSquares.push(i);
    }
  }

  let q = -1;
  for (let i = 0; i < nonBishopSquares.length; i++) {
    if (p[nonBishopSquares[i]] === 'Q') {
      q = i;
      break;
    }
  }

  // Find Knight combo index
  const nonBishopQueenSquares = nonBishopSquares.filter(sq => p[sq] !== 'Q');
  const knightIndices = [];
  for (let i = 0; i < nonBishopQueenSquares.length; i++) {
    if (p[nonBishopQueenSquares[i]] === 'N') {
      knightIndices.push(i);
    }
  }

  let n3 = -1;
  for (let i = 0; i < KNIGHT_COMBOS.length; i++) {
    if (KNIGHT_COMBOS[i][0] === knightIndices[0] && KNIGHT_COMBOS[i][1] === knightIndices[1]) {
      n3 = i;
      break;
    }
  }

  if (b1 === -1 || b2 === -1 || q === -1 || n3 === -1) {
    throw new Error(`Invalid Chess960 rank configuration: ${pieces}`);
  }

  return 4 * (4 * (6 * n3 + q) + b2) + b1;
}

/**
 * Generate full starting FEN for a Chess960 position.
 * @param {number|string} idOrRank - Position ID (0-959) or 8-char rank string
 * @returns {{ fen: string, rankString: string, id: number, whiteRookFiles: number[], blackRookFiles: number[], kingFile: number }}
 */
export function getChess960InitialState(idOrRank) {
  let id = 518;
  let rankString = 'RNBQKBNR';

  if (typeof idOrRank === 'number') {
    id = idOrRank;
    rankString = generateChess960Position(id);
  } else if (typeof idOrRank === 'string') {
    rankString = idOrRank.toUpperCase();
    id = getChess960Id(rankString);
  }

  const whiteRank = rankString;
  const blackRank = rankString.toLowerCase();

  // Determine rook and king initial files (0-7)
  const rookFiles = [];
  let kingFile = -1;
  for (let i = 0; i < 8; i++) {
    if (rankString[i] === 'R') rookFiles.push(i);
    if (rankString[i] === 'K') kingFile = i;
  }

  // Castling string in X-FEN / Shredder-FEN format:
  // Convert rook files to uppercase file letters (A-H) for white, (a-h) for black
  const fileLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const whiteCastle = fileLetters[rookFiles[1]] + fileLetters[rookFiles[0]]; // kingside then queenside
  const blackCastle = whiteCastle.toLowerCase();

  const fen = `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w KQkq - 0 1`;

  return {
    id,
    rankString,
    fen,
    whiteRookFiles: rookFiles, // [queensideRookFile, kingsideRookFile]
    blackRookFiles: rookFiles,
    kingFile
  };
}

/**
 * Generate random 960 position ID
 */
export function getRandomChess960Id() {
  return Math.floor(Math.random() * 960);
}
