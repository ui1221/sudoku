/**
 * Game State Manager
 * ステージ管理・アンドゥ履歴・タイマー・メモ・ヒントを管理する
 */

import { generatePuzzleForStage, checkInput, isBoardComplete, getHint, cloneBoard } from './sudoku.js';

const SAVE_KEY     = 'sudoku_game_state';
const PROGRESS_KEY = 'sudoku_stage_progress';
const MAX_HINTS    = 3;
export const MAX_STAGES = 45; // 9問 × 5セット = 45ステージ
export const STAGES_PER_SET = 9; // 1セット（1枚の絵）あたりのステージ数
export const NUM_SETS = 5; // 難易度ごとのセット数

// ====== ステージ進捗管理 ======
// 進捗データ構造: { easy: { "1": { cleared: true, usedHint: false }, ... }, ... }

function getProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // 後方互換: 旧データ（{ easy: 5 } のような数値）を新形式に移行
    return migrateProgress(parsed);
  } catch {
    return {};
  }
}

/** 旧データ形式を新形式に自動移行 */
function migrateProgress(old) {
  const result = {};
  for (const diff of ['easy', 'medium', 'hard']) {
    const v = old[diff];
    if (v === undefined || v === null) {
      result[diff] = {};
    } else if (typeof v === 'number') {
      // 旧形式: 現在ステージ番号 → 1〜(v-1)がクリア済み扱いに移行
      result[diff] = {};
      for (let i = 1; i < v; i++) {
        result[diff][String(i)] = { cleared: true, usedHint: false };
      }
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      result[diff] = v;
    } else {
      result[diff] = {};
    }
  }
  return result;
}

function saveProgress(p) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

/** ステージがクリア済みかどうか */
export function isStageCleared(difficulty, stage) {
  const p = getProgress();
  return !!(p[difficulty]?.[String(stage)]?.cleared);
}

/** ヒントを使用してクリアしたステージかどうか */
export function isStageHintCleared(difficulty, stage) {
  const p = getProgress();
  return !!(p[difficulty]?.[String(stage)]?.usedHint);
}

/** ステージをクリア済みとしてマークする */
export function markStageCleared(difficulty, stage, usedHint) {
  const p = getProgress();
  if (!p[difficulty]) p[difficulty] = {};
  // すでにヒントなしでクリア済みの場合は上書きしない（ヒントありに格下げしない）
  const existing = p[difficulty][String(stage)];
  if (existing?.cleared && !existing?.usedHint && usedHint) {
    // 自力クリア済みをヒントクリアに格下げしない
  } else {
    p[difficulty][String(stage)] = { cleared: true, usedHint: !!usedHint };
  }
  saveProgress(p);
}

/** 難易度全体のクリア状況を取得 */
export function getProgressData(difficulty) {
  const p = getProgress();
  return p[difficulty] ?? {};
}

/** 難易度ごとのクリア済みステージ数 */
export function getClearedCount(difficulty) {
  const data = getProgressData(difficulty);
  return Object.values(data).filter(v => v?.cleared).length;
}

// ====== セーブデータ（全ステージ）管理 ======
function getSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { lastPlayed: null, saves: {} };
    const parsed = JSON.parse(raw);
    
    // 移行ロジック（旧単一セーブデータがあれば新形式に包む）
    if (parsed.difficulty && parsed.stage && parsed.board) {
      const key = `${parsed.difficulty}_${parsed.stage}`;
      return {
        lastPlayed: { difficulty: parsed.difficulty, stage: parsed.stage },
        saves: { [key]: parsed }
      };
    }
    return parsed.saves ? parsed : { lastPlayed: null, saves: {} };
  } catch {
    return { lastPlayed: null, saves: {} };
  }
}

function persistSaveData(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

/** 途中のステージ一覧を配列で返す */
export function getInProgressStages(difficulty) {
  const data = getSaveData();
  const stages = [];
  for (const key in data.saves) {
    if (key.startsWith(`${difficulty}_`)) {
      stages.push(parseInt(key.split('_')[1], 10));
    }
  }
  return stages;
}

/** 最後にプレイした難易度とステージを返す */
export function getLastPlayed() {
  return getSaveData().lastPlayed; // { difficulty, stage } or null
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
  start(difficulty = 'medium', stage = null) {
    this._clearTimer();
    this._history = [];

    // stageが指定されていない場合は、未クリアの最初のステージを探す
    if (stage === null) {
      stage = this._findNextStage(difficulty);
    }

    // 既存のセーブデータがあればロードして再開
    const data = getSaveData();
    const existing = data.saves[`${difficulty}_${stage}`];
    if (existing) {
      this._restoreState(existing);
      return;
    }

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

  /** 未クリアの最初のステージを探す（全クリア済みなら1に戻る） */
  _findNextStage(difficulty) {
    for (let s = 1; s <= MAX_STAGES; s++) {
      if (!isStageCleared(difficulty, s)) return s;
    }
    return 1; // 全クリア時はステージ1から
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
        const usedHint = state.hintsUsed > 0;
        markStageCleared(state.difficulty, state.stage, usedHint);
        this._deleteCurrentSave();
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
      markStageCleared(state.difficulty, state.stage, true); // ヒント使用
      this._deleteCurrentSave();
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

  // ====== セーブデータ読み込み（最後にプレイしたステージを復元） ======
  load() {
    try {
      const data = getSaveData();
      if (!data.lastPlayed) return false;
      const { difficulty, stage } = data.lastPlayed;
      const saved = data.saves[`${difficulty}_${stage}`];
      if (!saved) return false;
      
      this._restoreState(saved);
      return true;
    } catch {
      return false;
    }
  }

  _restoreState(saved) {
    saved.notes = saved.notes.map((row) =>
      row.map((cellNotes) => new Set(cellNotes))
    );
    this.state    = saved;
    this._history = [];
    if (!this.state.completed && !this.state.paused) {
      this._startTimer();
    }
    this.onUpdate(this.state);
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
    if (!this.state || this.state.completed) return;
    const toSave = {
      ...this.state,
      notes: this.state.notes.map((row) => row.map((s) => [...s])),
    };
    
    const data = getSaveData();
    data.lastPlayed = { difficulty: this.state.difficulty, stage: this.state.stage };
    data.saves[`${this.state.difficulty}_${this.state.stage}`] = toSave;
    persistSaveData(data);
  }

  _deleteCurrentSave() {
    if (!this.state) return;
    const data = getSaveData();
    delete data.saves[`${this.state.difficulty}_${this.state.stage}`];
    persistSaveData(data);
  }
}
