/**
 * UI Controller
 */

import './style.css';
import {
  Game,
  MAX_STAGES,
  STAGES_PER_SET,
  NUM_SETS,
  isStageCleared,
  isStageHintCleared,
  getClearedCount,
  getProgressData,
  getInProgressStages,
  getLastPlayed,
} from './game.js';

// ====== クリア時のメッセージ（ランダム選択） ======
const FUNNY_MESSAGES = [
  'よっ、大統領！',
  '天才か！？',
  'もしかして人工知能ですか？',
  '師匠と呼ばせてください。',
  'IQ、高すぎでは？',
  '数独の神に選ばれし者よ…！',
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
  '頭がいいって、こういうことか！',
  'すごい！すごすぎる！',
  '伝説の始まりだ……。',
  'どこかで見たことがある！──そう、天才だ！',
  'もう弟子入りさせてください。よろしくお願いします。',
];

const CLEAR_EMOJIS = ['🎉', '🏆', '✨', '🌟', '🎊', '🥇', '👑', '🎯', '🚀', '💎'];

function getRandomFunnyMessage() {
  return FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
}
function getRandomEmoji() {
  return CLEAR_EMOJIS[Math.floor(Math.random() * CLEAR_EMOJIS.length)];
}

// ====== 難易度ごとの画像定義 ======
// import.meta.env.BASE_URL を使ってViteのbase設定（/sudoku/）に対応
const BASE = import.meta.env.BASE_URL; // 例: '/sudoku/'
const DIFF_IMAGES = {
  easy:   [1, 2, 3, 4, 5].map(n => `${BASE}stages/easy_${n}.webp`),
  medium: [1, 2, 3, 4, 5].map(n => `${BASE}stages/medium_${n}.webp`),
  hard:   [1, 2, 3, 4, 5].map(n => `${BASE}stages/hard_${n}.webp`),
};

const DIFF_LABEL = { easy: '初級', medium: '中級', hard: '上級' };

// ====== DOM 要素 ======
// 画面
const homeScreen      = document.getElementById('home-screen');
const stageScreen     = document.getElementById('stage-screen');
const gameScreen      = document.getElementById('game-screen');
// ステージ選択
const stageScreenTitle = document.getElementById('stage-screen-title');
const gallerySets     = document.getElementById('gallery-sets');
const btnStageBack    = document.getElementById('btn-stage-back');
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
const btnResetStage   = document.getElementById('btn-reset-stage');
const btnGotoStageSelect = document.getElementById('btn-goto-stage-select');
const confirmOverlay  = document.getElementById('confirm-overlay');
const btnConfirmYes   = document.getElementById('btn-confirm-yes');
const btnConfirmNo    = document.getElementById('btn-confirm-no');
const completionSheet = document.getElementById('completion-sheet');
const completionEmoji = document.getElementById('completion-emoji');
const completionTitle = document.getElementById('completion-title');
const completionFunny = document.getElementById('completion-funny');
const completionDetail= document.getElementById('completion-detail');
const btnNextStage    = document.getElementById('btn-next-stage');
const btnGoStageSelect = document.getElementById('btn-go-stage-select');
const btnGoHome       = document.getElementById('btn-go-home');

// ====== ゲームインスタンス ======
const game = new Game(render);
let currentDifficulty = 'medium';

// ====== BGM ======
const bgm = new Audio(`${BASE}audio/bgm.ogg`);
bgm.loop   = true;
bgm.volume = 0.10; // 10%（スマホのスピーカーでも聴こえる程度）

// 再生中でなければ play() を試みる（失敗しても次の操作でリトライ可能）
function startBgm() {
  if (!bgm.paused) return; // すでに再生中なら何もしない
  bgm.play().catch(() => {}); // ブラウザに拒否されても無視（次の操作で再挑戦できる）
}

// ====== 音量スライダー ======
const volumeSlider = document.getElementById('bgm-volume-slider');
const volumeLabel  = document.getElementById('volume-label');
const volumeIcon   = document.getElementById('volume-icon');

function updateVolumeUI(pct) {
  volumeLabel.textContent = `${pct}%`;
  volumeIcon.textContent  = pct === 0 ? '🔇' : '🎵';
  // スライダーの塗り（filled track）をグラデーションで表現
  const ratio = pct / 80;
  volumeSlider.style.background =
    `linear-gradient(to right, var(--accent-1) 0%, var(--accent-2) ${ratio * 100}%, var(--btn-border) ${ratio * 100}%)`;
}

volumeSlider.addEventListener('input', () => {
  const pct = parseInt(volumeSlider.value, 10);
  bgm.volume = pct / 100;
  updateVolumeUI(pct);
  localStorage.setItem('sudoku_bgm_volume', pct); // ページ再訪時も維持
  startBgm(); // スライダー操作もトリガーになる
});

// 保存済みの音量を復元
const savedVol = localStorage.getItem('sudoku_bgm_volume');
if (savedVol !== null) {
  const pct = parseInt(savedVol, 10);
  bgm.volume = pct / 100;
  volumeSlider.value = pct;
  updateVolumeUI(pct);
} else {
  volumeSlider.value = 10;
  updateVolumeUI(10); // 初期値 10%
}

// ====== 画面切り替え ======
function showHomeScreen() {
  updateHomeProgress();
  homeScreen.classList.remove('screen-hidden');
  stageScreen.classList.add('screen-hidden');
  gameScreen.classList.add('screen-hidden');
  completionSheet.classList.remove('visible');
  pauseOverlayEl.classList.remove('visible');
  document.getElementById('full-image-overlay')?.classList.remove('visible');
}

function showStageScreen(difficulty) {
  currentDifficulty = difficulty;
  stageScreenTitle.textContent = `${DIFF_LABEL[difficulty]} — ステージ選択`;
  renderGallery(difficulty);
  homeScreen.classList.add('screen-hidden');
  stageScreen.classList.remove('screen-hidden');
  gameScreen.classList.add('screen-hidden');
  completionSheet.classList.remove('visible');
  pauseOverlayEl.classList.remove('visible');
}

function showGameScreen() {
  homeScreen.classList.add('screen-hidden');
  stageScreen.classList.add('screen-hidden');
  gameScreen.classList.remove('screen-hidden');
}

// ====== ギャラリー画面を描画 ======
function renderGallery(difficulty) {
  gallerySets.innerHTML = '';
  const images = DIFF_IMAGES[difficulty];
  const progressData = getProgressData(difficulty);
  const inProgressStages = getInProgressStages(difficulty);
  const lastPlayed = getLastPlayed();

  for (let setIdx = 0; setIdx < NUM_SETS; setIdx++) {
    const setStartStage = setIdx * STAGES_PER_SET + 1; // 1始まり
    const imgUrl = images[setIdx];

    // セット全体がクリア済みか？
    let setAllCleared = true;
    for (let pos = 0; pos < STAGES_PER_SET; pos++) {
      const stage = setStartStage + pos;
      if (!isStageCleared(difficulty, stage)) { setAllCleared = false; break; }
    }

    const setEl = document.createElement('div');
    setEl.className = 'gallery-set';

    // セットラベル
    const labelEl = document.createElement('div');
    labelEl.className = 'gallery-set-label';
    labelEl.textContent = `SET ${setIdx + 1}`;
    setEl.appendChild(labelEl);

    // アートパネル（3x3グリッド）
    const panelEl = document.createElement('div');
    panelEl.className = 'art-panel';

    for (let pos = 0; pos < STAGES_PER_SET; pos++) {
      const stage = setStartStage + pos;
      const cleared = isStageCleared(difficulty, stage);
      const usedHint = isStageHintCleared(difficulty, stage);
      const inProgress = inProgressStages.includes(stage) && !cleared;
      const isLastPlayed = lastPlayed && lastPlayed.difficulty === difficulty && lastPlayed.stage === stage;

      // グリッド内の行・列（0始まり）
      const gridRow = Math.floor(pos / 3); // 0,1,2
      const gridCol = pos % 3;             // 0,1,2
      // background-positionはパーセント: 0%,50%,100%
      const bgPosX = gridCol === 0 ? '0%' : gridCol === 1 ? '50%' : '100%';
      const bgPosY = gridRow === 0 ? '0%' : gridRow === 1 ? '50%' : '100%';

      const pieceEl = document.createElement('div');
      pieceEl.className = 'stage-piece';
      if (isLastPlayed) pieceEl.classList.add('last-played');
      if (inProgress) pieceEl.classList.add('in-progress');
      pieceEl.setAttribute('role', 'button');
      pieceEl.setAttribute('aria-label', `ステージ ${stage}`);
      pieceEl.dataset.stage = stage;
      pieceEl.dataset.difficulty = difficulty;

      // 画像レイヤー
      const imgEl = document.createElement('div');
      imgEl.className = `stage-piece-img ${cleared ? 'cleared' : 'uncleared'}`;
      imgEl.style.backgroundImage = `url('${imgUrl}')`;
      imgEl.style.backgroundPosition = `${bgPosX} ${bgPosY}`;
      pieceEl.appendChild(imgEl);

      // テキストオーバーレイ
      const overlayEl = document.createElement('div');
      overlayEl.className = 'stage-piece-overlay';

      const numBadge = document.createElement('div');
      numBadge.className = 'stage-number-badge';
      // クリア後は番号を非表示にする（要望により生の絵を見せるため）
      if (!cleared) {
        numBadge.textContent = stage;
        overlayEl.appendChild(numBadge);
      }
      pieceEl.appendChild(overlayEl);

      // ヒント使用バッジ
      if (cleared && usedHint) {
        const hintBadgeEl = document.createElement('div');
        hintBadgeEl.className = 'hint-badge';
        hintBadgeEl.textContent = '💡';
        hintBadgeEl.title = 'ヒントを使用してクリア';
        pieceEl.appendChild(hintBadgeEl);
      }

      // プレイ中バッジ
      if (inProgress) {
        const progressBadge = document.createElement('div');
        progressBadge.className = 'in-progress-badge';
        progressBadge.textContent = '⏳';
        pieceEl.appendChild(progressBadge);
      }

      // クリックでゲーム開始（BGMのトリガーも兼ねる）
      pieceEl.addEventListener('click', () => {
        triggerRipple(pieceEl);
        startBgm();
        game.start(difficulty, stage);
        showGameScreen();
      });

      panelEl.appendChild(pieceEl);

      // 最後にプレイしたステージの場合は描画後に自動スクロール
      if (isLastPlayed) {
        setTimeout(() => {
          pieceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }

    setEl.appendChild(panelEl);

    // 全クリアバナー（イラストを見るボタン）
    if (setAllCleared) {
      const bannerEl = document.createElement('div');
      bannerEl.className = 'set-complete-banner';
      bannerEl.textContent = '👁️ イラストを見る';
      bannerEl.setAttribute('role', 'button');
      bannerEl.addEventListener('click', () => {
        triggerRipple(bannerEl);
        document.getElementById('full-image-content').src = imgUrl;
        document.getElementById('full-image-overlay').classList.add('visible');
      });
      setEl.appendChild(bannerEl);
    }

    gallerySets.appendChild(setEl);
  }
}

// ====== ホーム画面の進捗更新 ======
function updateHomeProgress() {
  ['easy', 'medium', 'hard'].forEach((diff) => {
    const cleared = getClearedCount(diff);
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
  initTheme(); // 初期化時にテーマを復元
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

    const diffLabel = DIFF_LABEL[state.difficulty];
    const timeStr   = game.formatTime(state.elapsed);
    const usedHint  = state.hintsUsed > 0;

    completionEmoji.textContent  = getRandomEmoji();
    completionTitle.textContent  = 'クリア！';
    completionFunny.textContent  = getRandomFunnyMessage();
    completionDetail.textContent = `${diffLabel} ステージ${state.stage}　／　タイム: ${timeStr}${usedHint ? '　💡ヒント使用' : ''}`;

    // 次のステージを探す（未クリアの最小番号）
    const nextStage = findNextUnclearedStage(state.difficulty, state.stage);
    if (nextStage === null) {
      btnNextStage.textContent = '🏆 全クリア！続けて遊ぶ';
    } else {
      btnNextStage.textContent = `ステージ ${nextStage} へ →`;
    }
    btnNextStage.dataset.nextStage = nextStage ?? 1;

    completionSheet.classList.add('visible');
  } else {
    pauseOverlayEl.classList.remove('visible');
    completionSheet.classList.remove('visible');
  }
}

/** 指定難易度で最も若い番号の未クリアステージを返す（全クリアなら null） */
function findNextUnclearedStage(difficulty, currentStage) {
  // まず次のステージ以降から探す
  for (let s = currentStage + 1; s <= MAX_STAGES; s++) {
    if (!isStageCleared(difficulty, s)) return s;
  }
  // 見つからなければ最初から探す
  for (let s = 1; s < currentStage; s++) {
    if (!isStageCleared(difficulty, s)) return s;
  }
  return null; // 全クリア
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

  // ステージ選択ヘッダーの戻るボタン
  btnStageBack.addEventListener('click', () => showHomeScreen());

  // 一時停止オーバーレイ
  btnResume.addEventListener('click', () => game.togglePause());
  pauseOverlayEl.addEventListener('click', (e) => {
    if (e.target === pauseOverlayEl) game.togglePause();
  });

  // やり直し関係
  btnResetStage.addEventListener('click', () => {
    pauseOverlayEl.classList.remove('visible');
    confirmOverlay.classList.add('visible');
  });
  btnConfirmNo.addEventListener('click', () => {
    confirmOverlay.classList.remove('visible');
    pauseOverlayEl.classList.add('visible');
  });
  btnConfirmYes.addEventListener('click', () => {
    confirmOverlay.classList.remove('visible');
    game.togglePause(); // 一時停止解除（タイマー停止のまま保存）
    game.start(currentDifficulty, game.state?.stage); // 同じステージをリセット
  });

  // フルイメージオーバーレイ
  const fullImageOverlay = document.getElementById('full-image-overlay');
  document.getElementById('btn-close-full-image')?.addEventListener('click', () => {
    fullImageOverlay.classList.remove('visible');
  });
  fullImageOverlay?.addEventListener('click', (e) => {
    if (e.target === fullImageOverlay) fullImageOverlay.classList.remove('visible');
  });

  // 一時停止メニューからステージ選択へ
  btnGotoStageSelect.addEventListener('click', () => {
    pauseOverlayEl.classList.remove('visible');
    game.togglePause(); // 一時停止解除（タイマー停止のまま保存）
    showStageScreen(currentDifficulty);
  });

  // テーマ切り替え
  document.querySelector('.home-hero-text').addEventListener('click', toggleTheme);
  document.querySelector('.app-title').addEventListener('click', toggleTheme);

  // 完成シート
  btnNextStage.addEventListener('click', () => {
    completionSheet.classList.remove('visible');
    const nextStage = parseInt(btnNextStage.dataset.nextStage) || 1;
    game.start(currentDifficulty, nextStage);
    showGameScreen();
  });
  btnGoStageSelect.addEventListener('click', () => {
    completionSheet.classList.remove('visible');
    showStageScreen(currentDifficulty);
  });
  btnGoHome.addEventListener('click', () => showHomeScreen());

  // ホーム画面の難易度カード → ステージ選択画面へ（BGMのトリガーも兼ねる）
  ['easy', 'medium', 'hard'].forEach((diff) => {
    document.getElementById(`card-${diff}`)?.addEventListener('click', () => {
      triggerRipple(document.getElementById(`card-${diff}`));
      startBgm();
      showStageScreen(diff);
    });
  });
}

// ====== キーボード操作（PC対応） ======
document.addEventListener('keydown', (e) => {
  if (!game.state || gameScreen.classList.contains('screen-hidden')) return;

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

// ====== テーマ（ライト/ダーク）切り替え ======
function initTheme() {
  const saved = localStorage.getItem('sudoku_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeMeta(saved);
  }
}

function toggleTheme() {
  let current = document.documentElement.getAttribute('data-theme');
  if (!current) {
    current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sudoku_theme', next);
  updateThemeMeta(next);
}

function updateThemeMeta(theme) {
  const meta = document.getElementById('meta-theme-color');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f0e1a' : '#f0f4ff');
  }
}

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
