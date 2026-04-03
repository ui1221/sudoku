/**
 * Game State Manager
 * ステージ管理・アンドゥ履歴・タイマー・メモ・ヒントを管理する
 */

import { generatePuzzleForStage, checkInput, isBoardComplete, getHint, cloneBoard } from './sudoku.js';

const SAVE_KEY     = 'sudoku_game_state';
const PROGRESS_KEY = 'sudoku_stage_progress';
const MAX_HINTS    = 3;
export const MAX_STAGES = 50;

// ====== ステージ進捗管理 ======
function getProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch { return {}; }
}
function saveProgress(p) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

/** 現在のステージ番号（1始まり）を返す */
export function getCurrentStage(difficulty) {
  return getProgress()[difficulty] ?? 1;
}

/** クリア後に次のステージへ進める */
export function advanceStage(difficulty) {
  const p = getProgress();
  const next = Math.min((p[difficulty] ?? 1) + 1, MAX_STAGES);
  p[difficulty] = next;
  saveProgress(p);
  return next;
}

/** 難易度の進捗をリセット（ステージ1に戻す） */
export function resetStageProgress(difficulty) {
  const p = getProgress();
  p[difficulty] = 1;
  saveProgress(p);
}

// ====== Game クラス ======
export class Game {
  constructor(onUpdate) {
    this.onUpdate  = onUpdate;
    this.state     = null;
    this._timerInterval = null;
    this._history  = []; // in-memory アンドゥ履歴
  }

  // ====== ゲーム開始 ======
  start(difficulty = 'medium') {
    this._clearTimer();
    this._history = [];

    const stage = getCurrentStage(difficulty);
    const { puzzle, solution } = generatePuzzleForStage(difficulty, stage);

    const notes = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );
    const fixed = puzzle.map((row) => row.map((v) => v !== 0));

    this.state = {
      difficulty,
      stage,
      puzzle:    cloneBoard(puzzle),
      solution,
      board:     cloneBoard(puzzle),
      notes,
      fixed,
      selected:  null,
      noteMode:  false,
      hintsUsed: 0,
      maxHints:  MAX_HINTS,
      elapsed:   0,
      paused:    false,
      completed: false,
      errorCell: null,
    };

    this._startTimer();
    this._save();
    this.onUpdate(this.state);
  }

  // ====== セル選択 ======
  selectCell(row, col) {
    if (!this.state || this.state.completed) return;
    if (this.state.selected?.row === row && this.state.selected?.col === col) {
      this.state.selected = null;
    } else {
      this.state.selected = { row, col };
    }
    this.onUpdate(this.state);
  }

  // ====== 数字入力 ======
  inputNumber(num) {
    const { state } = this;
    if (!state || !state.selected || state.completed) return;
    const { row, col } = state.selected;
    if (state.fixed[row][col]) return;

    if (state.noteMode) {
      if (state.board[row][col] !== 0) return;
      this._pushHistory();
      const noteSet = state.notes[row][col];
      if (noteSet.has(num)) noteSet.delete(num);
      else noteSet.add(num);
    } else {
      const isCorrect = checkInput(state.board, row, col, num);
      if (!isCorrect) {
        // エラーフラッシュ（履歴には積まない）
        state.errorCell = { row, col };
        this.onUpdate(state);
        setTimeout(() => {
          if (state.errorCell?.row === row && state.errorCell?.col === col) {
            state.errorCell = null;
            this.onUpdate(state);
          }
        }, 800);
        this._save();
        return;
      }

      this._pushHistory();
      state.errorCell = null;
      state.board[row][col] = num;
      this._clearRelatedNotes(row, col, num);

      if (isBoardComplete(state.board, state.solution)) {
        this._clearTimer();
        state.completed = true;
        advanceStage(state.difficulty);
      }
    }

    this._save();
    this.onUpdate(state);
  }

  // ====== 消しゴム ======
  erase() {
    const { state } = this;
    if (!state || !state.selected || state.completed) return;
    const { row, col } = state.selected;
    if (state.fixed[row][col]) return;

    this._pushHistory();
    if (state.board[row][col] !== 0) {
      state.board[row][col] = 0;
    } else {
      state.notes[row][col].clear();
    }

    this._save();
    this.onUpdate(state);
  }

  // ====== 一手戻る ======
  undo() {
    if (!this.state || this._history.length === 0 || this.state.completed) return;
    const snap = this._history.pop();
    this.state.board     = snap.board;
    this.state.notes     = snap.notes;
    this.state.hintsUsed = snap.hintsUsed;
    this.state.fixed     = snap.fixed;
    this.state.errorCell = null;
    this._save();
    this.onUpdate(this.state);
  }

  // ====== メモモード切り替え ======
  toggleNoteMode() {
    if (!this.state) return;
    this.state.noteMode = !this.state.noteMode;
    this.onUpdate(this.state);
  }

  // ====== ヒント ======
  useHint() {
    const { state } = this;
    if (!state || !state.selected || state.completed) return;
    if (state.hintsUsed >= state.maxHints) return;
    const { row, col } = state.selected;
    if (state.fixed[row][col]) return;
    if (state.board[row][col] === state.solution[row][col]) return;

    this._pushHistory();
    const answer = getHint(row, col, state.solution);
    state.board[row][col] = answer;
    state.notes[row][col].clear();
    state.hintsUsed++;
    state.fixed[row][col] = true;
    this._clearRelatedNotes(row, col, answer);

    if (isBoardComplete(state.board, state.solution)) {
      this._clearTimer();
      state.completed = true;
      advanceStage(state.difficulty);
    }

    this._save();
    this.onUpdate(state);
  }

  // ====== 一時停止 / 再開 ======
  togglePause() {
    if (!this.state || this.state.completed) return;
    if (this.state.paused) {
      this._startTimer();
      this.state.paused = false;
    } else {
      this._clearTimer();
      this.state.paused = true;
    }
    this.onUpdate(this.state);
  }

  // ====== セーブデータ読み込み ======
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      // 旧データにstageがない場合の後方互換
      if (!saved.stage) saved.stage = getCurrentStage(saved.difficulty ?? 'medium');
      saved.notes = saved.notes.map((row) =>
        row.map((cellNotes) => new Set(cellNotes))
      );
      this.state    = saved;
      this._history = [];
      if (!this.state.completed && !this.state.paused) {
        this._startTimer();
      }
      this.onUpdate(this.state);
      return true;
    } catch {
      return false;
    }
  }

  // ====== ユーティリティ ======
  formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  hasHistory() {
    return this._history.length > 0;
  }

  // ====== 内部メソッド ======
  _pushHistory() {
    this._history.push({
      board:     cloneBoard(this.state.board),
      notes:     this.state.notes.map((row) => row.map((s) => new Set(s))),
      hintsUsed: this.state.hintsUsed,
      fixed:     this.state.fixed.map((row) => [...row]),
    });
    if (this._history.length > 100) this._history.shift();
  }

  _clearRelatedNotes(row, col, num) {
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 9; i++) {
      this.state.notes[row][i].delete(num);
      this.state.notes[i][col].delete(num);
    }
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        this.state.notes[r][c].delete(num);
      }
    }
  }

  _startTimer() {
    this._clearTimer();
    this._timerInterval = setInterval(() => {
      if (this.state && !this.state.paused && !this.state.completed) {
        this.state.elapsed++;
        this.onUpdate(this.state);
      }
    }, 1000);
  }

  _clearTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _save() {
    if (!this.state) return;
    const toSave = {
      ...this.state,
      notes: this.state.notes.map((row) => row.map((s) => [...s])),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
  }
}
