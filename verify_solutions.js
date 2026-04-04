import { generatePuzzleForStage, cloneBoard } from './src/sudoku.js';

// Copy the solver logic from src/sudoku.js to be absolutely sure what we are testing
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

function countSolutions(board, limit = 10) {
  let count = 0;
  const solutions = [];

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
    solutions.push(cloneBoard(board));
  }
  solve();
  return { count, solutions };
}

const difficulty = 'hard';
const stage = 1;

console.log(`Checking Stage: ${difficulty} - ${stage}...`);
const { puzzle } = generatePuzzleForStage(difficulty, stage);

const { count, solutions } = countSolutions(puzzle, 10);

console.log(`Found ${count} solution(s).`);

if (count > 0) {
    console.log('Solution 1:');
    console.log(solutions[0].map(row => row.join(' ')).join('\n'));
}

if (count > 1) {
    console.log('\nSolution 2:');
    console.log(solutions[1].map(row => row.join(' ')).join('\n'));
}
