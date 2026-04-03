/**
 * UI Controller
 */

import './style.css';
import { Game, MAX_STAGES, getCurrentStage, resetStageProgress } from './game.js';

// ====== クリア時のメッセージ（ランダム選択） ======
const FUNNY_MESSAGES = [
  'よっ、大統領！',
  '天才か！？',
  'もしかして人工知能ですか？',
  'カンニングじゃないよね？',
  '脳みそ大丈夫ですか？（褒めてます）',
  '師匠と呼ばせてください。',
  '解くの速すぎて問題が泣いてます。',
  '完璧すぎて引く！（最大級の褒め言葉）',
  'IQ、高すぎでは？',
  '世界記録更新のお知らせ（嘘）',
  '数独の神に選ばれし者よ…！',
  'あなた、本当に人間ですか？',
  'さすがです！（土下座）',
  'ブラボー！！！（三回言いたい）',
  'やったじゃないですか〜！',
  'えぇ！もう解けたの！？',
  '数字と友達なんですね、うらやましい。',
  '解いた瞬間、宇宙が震えた（たぶん）。',
  '待って、マジで？すごくない？',
  '将来は数独プロですね。',
  'あっぱれ！お見事！',
  '脱帽！！帽子が吹っ飛んだ！！',
  '速い！速すぎる！光より速い！（比喩）',
  'この才能、もったいない！',
  '数独マシーン、降臨。',
  '凡人の私には理解できません（褒めてます）。',
  '問題「もう無理……」（問題の気持ち）',
  '頭がいいって、こういうことか！',
  '解けちゃった！どうして！？',
  'すごい！すごすぎる！すごすぎてごめん！',
  '次は上級にチャレンジしてみては？（煽り）',
  '伝説の始まりだ……。',
  'どこかで見たことがある！──そう、天才だ！',
  'このゲーム、あなたには簡単すぎたかな？',
  'もう弟子入りさせてください。よろしくお願いします。',
];

const CLEAR_EMOJIS = ['🎉', '🏆', '✨', '🌟', '🎊', '🥇', '👑', '🎯', '🚀', '💎'];

function getRandomFunnyMessage() {
  return FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
}

function getRandomEmoji() {
  return CLEAR_EMOJIS[Math.floor(Math.random() * CLEAR_EMOJIS.length)];
}

// ====== DOM 要素 ======
// 画面
const homeScreen      = document.getElementById('home-screen');
const gameScreen      = document.getElementById('game-screen');
// ゲーム内
const boardEl         = document.getElementById('board');
const timerEl         = document.getElementById('timer');
const stageEl         = document.getElementById('stage-display');
const hintsEl         = document.getElementById('hints-used');
const numpadEl        = document.getElementById('numpad');
const noteModeBtn     = document.getElementById('btn-note');
const eraseBtn        = document.getElementById('btn-erase');
const hintBtn         = document.getElementById('btn-hint');
const undoBtn         = document.getElementById('btn-undo');
const pauseBtn        = document.getElementById('btn-pause');
const homeBtn         = document.getElementById('btn-home');
// オーバーレイ
const pauseOverlayEl  = document.getElementById('pause-overlay');
const btnResume       = document.getElementById('btn-resume');
const completionSheet = document.getElementById('completion-sheet');
const completionEmoji = document.getElementById('completion-emoji');
const completionTitle = document.getElementById('completion-title');
const completionFunny = document.getElementById('completion-funny');
const completionDetail= document.getElementById('completion-detail');
const btnNextStage    = document.getElementById('btn-next-stage');
const btnGoHome       = document.getElementById('btn-go-home');

// ====== ゲームインスタンス ======
const game = new Game(render);
let currentDifficulty = 'medium';

// ====== 画面切り替え ======
function showHomeScreen() {
  updateHomeProgress();
  homeScreen.classList.remove('screen-hidden');
  gameScreen.classList.add('screen-hidden');
  completionSheet.classList.remove('visible');
  pauseOverlayEl.classList.remove('visible');
}

function showGameScreen() {
  homeScreen.classList.add('screen-hidden');
  gameScreen.classList.remove('screen-hidden');
}

// ====== ホーム画面の進捗更新 ======
function updateHomeProgress() {
  ['easy', 'medium', 'hard'].forEach((diff) => {
    const cleared = Math.max(0, getCurrentStage(diff) - 1);
    const pct     = Math.min((cleared / MAX_STAGES) * 100, 100);

    const barEl  = document.getElementById(`progress-bar-${diff}`);
    const textEl = document.getElementById(`progress-text-${diff}`);
    if (barEl)  barEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `${cleared}/${MAX_STAGES}`;

    // 全クリア時にカードを光らせる
    const cardEl = document.getElementById(`card-${diff}`);
    if (cardEl) cardEl.classList.toggle('all-clear', cleared >= MAX_STAGES);
  });
}

// ====== 初期化 ======
function init() {
  buildBoard();
  setupNumpad();
  setupControls();
  showHomeScreen(); // 起動時はホーム画面を表示
}

// ====== 盤面DOM生成（初回のみ） ======
function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (c === 2 || c === 5) cell.classList.add('block-right');
      if (r === 2 || r === 5) cell.classList.add('block-bottom');
      cell.addEventListener('click', () => game.selectCell(r, c));
      boardEl.appendChild(cell);
    }
  }
}

// ====== 盤面の再描画 ======
function renderBoard(state) {
  const cells = boardEl.querySelectorAll('.cell');
  const { board, fixed, notes, selected, errorCell, noteMode } = state;

  const selRow = selected?.row ?? -1;
  const selCol = selected?.col ?? -1;
  const selNum = (selected && board[selRow]?.[selCol]) || 0;

  cells.forEach((cell) => {
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    const val = board[r][c];

    cell.className = 'cell';
    if (c === 2 || c === 5) cell.classList.add('block-right');
    if (r === 2 || r === 5) cell.classList.add('block-bottom');

    if (fixed[r][c]) cell.classList.add('fixed');
    if (r === selRow && c === selCol) cell.classList.add('selected');
    else if (r === selRow || c === selCol) cell.classList.add('related');
    else if (
      Math.floor(r / 3) === Math.floor(selRow / 3) &&
      Math.floor(c / 3) === Math.floor(selCol / 3)
    ) cell.classList.add('related');

    if (selNum > 0 && val === selNum) cell.classList.add('same-number');
    if (errorCell?.row === r && errorCell?.col === c) cell.classList.add('error');

    cell.innerHTML = '';
    if (val !== 0) {
      const span = document.createElement('span');
      span.classList.add('cell-number');
      if (!fixed[r][c]) span.classList.add('user-input');
      span.textContent = val;
      cell.appendChild(span);
    } else {
      const noteSet = notes[r][c];
      if (noteSet.size > 0) {
        const noteGrid = document.createElement('div');
        noteGrid.classList.add('note-grid');
        for (let n = 1; n <= 9; n++) {
          const nd = document.createElement('span');
          nd.textContent = noteSet.has(n) ? n : '';
          if (noteSet.has(n) && selNum > 0 && selNum === n) nd.classList.add('note-highlight');
          noteGrid.appendChild(nd);
        }
        cell.appendChild(noteGrid);
      }
    }
    if (noteMode && val === 0 && !fixed[r][c]) cell.classList.add('note-mode-cell');
  });
}

// ====== ナンバーパッドのグレーアウト ======
function updateNumpadExhaustion(board) {
  const counts = new Array(10).fill(0);
  for (const row of board) {
    for (const val of row) {
      if (val > 0) counts[val]++;
    }
  }
  for (let n = 1; n <= 9; n++) {
    const btn = document.getElementById(`num-btn-${n}`);
    if (!btn) continue;
    const done = counts[n] >= 9;
    btn.classList.toggle('exhausted', done);
    btn.disabled = done;
  }
}

// ====== UIの全体更新（Game → UIへのコールバック） ======
function render(state) {
  if (!state) return;

  renderBoard(state);
  timerEl.textContent  = game.formatTime(state.elapsed);
  stageEl.textContent  = `${state.stage}/${MAX_STAGES}`;

  const hintsLeft = state.maxHints - state.hintsUsed;
  hintsEl.textContent  = hintsLeft;
  hintBtn.disabled     = hintsLeft <= 0 || state.completed;
  undoBtn.disabled     = !game.hasHistory() || state.completed;
  noteModeBtn.classList.toggle('active', state.noteMode);

  pauseBtn.textContent = state.paused ? '▶' : '⏸';
  pauseBtn.setAttribute('aria-label', state.paused ? '再開' : '一時停止');

  updateNumpadExhaustion(state.board);

  // オーバーレイ制御
  if (state.paused && !state.completed) {
    pauseOverlayEl.classList.add('visible');
    completionSheet.classList.remove('visible');
  } else if (state.completed) {
    pauseOverlayEl.classList.remove('visible');

    const diffLabel = { easy: '初級', medium: '中級', hard: '上級' }[state.difficulty];
    const timeStr   = game.formatTime(state.elapsed);
    const nextStage = state.stage + 1;

    completionEmoji.textContent  = getRandomEmoji();
    completionTitle.textContent  = 'クリア！';
    completionFunny.textContent  = getRandomFunnyMessage();
    completionDetail.textContent = `${diffLabel} ステージ${state.stage}　／　タイム: ${timeStr}`;

    if (nextStage > MAX_STAGES) {
      btnNextStage.textContent = '🏆 全クリア！もう一周する';
    } else {
      btnNextStage.textContent = `ステージ ${nextStage} へ →`;
    }

    completionSheet.classList.add('visible');
  } else {
    pauseOverlayEl.classList.remove('visible');
    completionSheet.classList.remove('visible');
  }
}

// ====== ナンバーパッド生成 ======
function setupNumpad() {
  numpadEl.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.classList.add('num-btn');
    btn.textContent = n;
    btn.id = `num-btn-${n}`;
    btn.addEventListener('click', () => {
      game.inputNumber(n);
      triggerRipple(btn);
    });
    numpadEl.appendChild(btn);
  }
}

// ====== コントロールボタン ======
function setupControls() {
  // ゲーム内コントロール
  noteModeBtn.addEventListener('click', () => { game.toggleNoteMode(); triggerRipple(noteModeBtn); });
  eraseBtn.addEventListener('click',    () => { game.erase();          triggerRipple(eraseBtn); });
  hintBtn.addEventListener('click',     () => { game.useHint();        triggerRipple(hintBtn); });
  undoBtn.addEventListener('click',     () => { game.undo();           triggerRipple(undoBtn); });
  pauseBtn.addEventListener('click',    () => game.togglePause());
  homeBtn.addEventListener('click',     () => showHomeScreen());

  // 一時停止オーバーレイ
  btnResume.addEventListener('click', () => game.togglePause());
  pauseOverlayEl.addEventListener('click', (e) => {
    if (e.target === pauseOverlayEl) game.togglePause();
  });

  // 完成シート
  btnNextStage.addEventListener('click', () => {
    completionSheet.classList.remove('visible');
    game.start(currentDifficulty);
  });
  btnGoHome.addEventListener('click', () => showHomeScreen());

  // ホーム画面の難易度カード（ボタン化）
  ['easy', 'medium', 'hard'].forEach((diff) => {
    document.getElementById(`card-${diff}`)?.addEventListener('click', () => {
      currentDifficulty = diff;
      triggerRipple(document.getElementById(`card-${diff}`));
      // 同じ難易度のセーブがあれば続きから、なければ新規開始
      const hasSave = game.load();
      if (!hasSave || game.state?.difficulty !== diff) {
        game.start(diff);
      }
      showGameScreen();
    });
  });
}

// ====== キーボード操作（PC対応） ======
document.addEventListener('keydown', (e) => {
  if (!game.state || homeScreen.offsetParent !== null) return; // ホーム画面中は無視

  const key = e.key;
  if (/^[1-9]$/.test(key)) { game.inputNumber(parseInt(key)); return; }

  const { selected } = game.state;
  if (selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    e.preventDefault();
    let { row, col } = selected;
    if (key === 'ArrowUp')    row = Math.max(0, row - 1);
    if (key === 'ArrowDown')  row = Math.min(8, row + 1);
    if (key === 'ArrowLeft')  col = Math.max(0, col - 1);
    if (key === 'ArrowRight') col = Math.min(8, col + 1);
    game.selectCell(row, col);
    return;
  }

  if (key === 'Backspace' || key === 'Delete')           { game.erase();          return; }
  if (key === 'n' || key === 'N')                        { game.toggleNoteMode(); return; }
  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') { e.preventDefault(); game.undo(); }
});

// ====== リップルエフェクト ======
function triggerRipple(el) {
  if (!el) return;
  el.classList.remove('ripple');
  void el.offsetWidth;
  el.classList.add('ripple');
  el.addEventListener('animationend', () => el.classList.remove('ripple'), { once: true });
}

// ====== スタート ======
init();

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
