import { generatePuzzleForStage } from './src/sudoku.js';

const difficulty = 'hard';
const stage = 1;

const { puzzle, solution } = generatePuzzleForStage(difficulty, stage);

function printBoard(board) {
  let output = '';
  for (let r = 0; r < 9; r++) {
    if (r % 3 === 0 && r !== 0) output += '-'.repeat(21) + '\n';
    let rowStr = '';
    for (let c = 0; c < 9; c++) {
      if (c % 3 === 0 && c !== 0) rowStr += '| ';
      rowStr += (board[r][c] === 0 ? '.' : board[r][c]) + ' ';
    }
    output += rowStr.trim() + '\n';
  }
  return output;
}

console.log('--- PUZZLE ---');
console.log(printBoard(puzzle));
console.log('\n--- SOLUTION ---');
console.log(printBoard(solution));
