/**
 * Sudoku Engine
 * - 唯一解を保証するパズル生成
 * - ステージ番号 + 難易度から決定論的にパズルを生成（同じステージ = 同じ問題）
 * - ランダム生成時は重複防止（localStorage 履歴管理）
 */

// ====== シード付き乱数生成器 (Mulberry32) ======
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ====== 盤面操作ユーティリティ ======
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function createEmptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function isValid(board, row, col, num) {
  if (board[row].includes(num)) return false;
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

// ====== 完成盤面の生成（バックトラッキング + RNG） ======
function fillBoard(board, rng) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
        for (const num of nums) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board, rng)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// ====== ソルバー（唯一解チェック用） ======
function countSolutions(board, limit = 2) {
  let count = 0;
  function solve() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(board, row, col, num)) {
              board[row][col] = num;
              solve();
              board[row][col] = 0;
              if (count >= limit) return;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

// ====== 穴開け処理（唯一解を保証しながら数字を削除） ======
const DIFFICULTY_CLUES = {
  easy:   36,
  medium: 30,
  hard:   24,
};

function digHoles(filledBoard, targetClues, rng) {
  const board = cloneBoard(filledBoard);
  const positions = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  shuffleArray(positions, rng);

  let clues = 81;
  for (const [r, c] of positions) {
    if (clues <= targetClues) break;
    const backup = board[r][c];
    board[r][c] = 0;
    const testBoard = cloneBoard(board);
    if (countSolutions(testBoard, 2) !== 1) {
      board[r][c] = backup;
    } else {
      clues--;
    }
  }
  return board;
}

// ====== ステージベースの決定論的パズル生成 ======
/**
 * 難易度とステージ番号から常に同じパズルを生成する。
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} stage - 1始まり
 */
export function generatePuzzleForStage(difficulty, stage) {
  const diffOffset = { easy: 1, medium: 2, hard: 3 }[difficulty] ?? 2;
  // 素数を使ったハッシュで、各ステージにユニークなシードを割り当てる
  const seed = ((diffOffset * 1_000_003) + (stage * 99_991)) >>> 0;
  const rng = mulberry32(seed);

  const filled = createEmptyBoard();
  fillBoard(filled, rng);
  const solution = cloneBoard(filled);

  const targetClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.medium;
  const puzzle = digHoles(filled, targetClues, rng);

  return { puzzle, solution };
}

// ====== 入力値の検証 ======
export function checkInput(board, row, col, num) {
  const testBoard = cloneBoard(board);
  testBoard[row][col] = 0;
  return isValid(testBoard, row, col, num);
}

export function isBoardComplete(board, solution) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

export function getHint(row, col, solution) {
  return solution[row][col];
}
