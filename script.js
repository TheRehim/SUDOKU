// ---- Utilities ----
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---- State ----
let state = {
  grid: [],
  solution: [],
  prefill: [],
  notes: [],
  selected: -1,
  notesMode: false,
  history: [],
  mode: 'classic',
  difficulty: 'easy',
  killerCages: [],
  hintsUsed: 0,
  blobs: []
};

// ---- DOM Elements ----
const boardEl = $('#board');
const cageCanvas = $('#cageLayer');
const statusEl = $('#status');
const themeToggle = $('#themeToggle');
const modeBtns = $$('.mode-btn');
const diffBtns = $$('.diff-btn');
const numBtns = $$('.num-btn');
const eraseBtn = $('#eraseBtn');
const newGameBtn = $('#newGameBtn');
const undoBtn = $('#undoBtn');
const hintBtn = $('#hintBtn');
const notesToggle = $('#notesToggle');
const checkBtn = $('#checkBtn');
const solveBtn = $('#solveBtn');
const menuScreen = $('#menuScreen');
const gameScreen = $('#gameScreen');
const startGameBtn = $('#startGameBtn');
const backToMenuBtn = $('#backToMenuBtn');
const currentModeEl = $('#currentMode');
const currentDiffEl = $('#currentDiff');

// ---- Constants ----
const CELL_SIZE = 48;
const INSET = 6;

// ---- Board setup ----
function buildBoard() {
  // Generate dynamic CSS for blob colors
  let blobCSS = '';
  state.blobs.forEach((blob, blobIndex) => {
    const baseColor = blob.color;
    blob.cells.forEach((cellPos, cellIndex) => {
      // Create different shades for each cell in the blob
      const hue = (parseInt(baseColor.slice(1, 3), 16) + cellIndex * 20) % 256;
      const sat = Math.min(100, parseInt(baseColor.slice(3, 5), 16) + cellIndex * 5);
      const light = Math.min(90, Math.max(30, parseInt(baseColor.slice(5, 7), 16) + cellIndex * 3));
      const cellColor = `hsl(${hue}, ${sat}%, ${light}%)`;
      blobCSS += `.blob-${blobIndex}.cell-${cellPos} { background: ${cellColor} !important; }\n`;
    });
  });

  // Apply the CSS
  let styleEl = document.getElementById('dynamic-blob-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-blob-styles';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = blobCSS;

  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const idx = r * 9 + c;
      const blobId = state.blobs.findIndex(blob => blob.cells.includes(idx));
      const cell = document.createElement('div');
      cell.className = `cell cell-${idx}${blobId !== -1 ? ` blob-${blobId}` : ''}`;
      cell.dataset.idx = idx;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.inputMode = 'numeric';
      input.addEventListener('focus', () => selectCell(idx));
      input.addEventListener('keydown', onCellKeydown);
      cell.appendChild(input);
      const notesDiv = document.createElement('div');
      notesDiv.className = 'notes';
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement('span');
        span.textContent = '';
        notesDiv.appendChild(span);
      }
      cell.appendChild(notesDiv);
      cell.addEventListener('click', () => {
        selectCell(idx);
        input.focus();
      });
      boardEl.appendChild(cell);
    }
  }
}

function selectCell(idx) {
  state.selected = idx;
  $$('.cell').forEach(cell => cell.classList.remove('selected'));
  const cell = $(`.cell[data-idx="${idx}"]`);
  if (cell) cell.classList.add('selected');
}

function setTheme(light) {
  document.body.classList.toggle('light-theme', light);
}

// ---- Sudoku core ----
function makeEmptyGrid() { return new Array(81).fill(0); }

function isValid(grid, pos, val) {
  const r = Math.floor(pos / 9), c = pos % 9;
  for (let i = 0; i < 9; i++) {
    if (grid[r * 9 + i] === val || grid[i * 9 + c] === val) return false;
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
    if (grid[(br + rr) * 9 + (bc + cc)] === val) return false;
  }
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSolution(grid) {
  const idx = grid.findIndex(v => v === 0);
  if (idx === -1) return true;
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const n of nums) {
    if (isValid(grid, idx, n)) {
      grid[idx] = n;
      if (generateSolution(grid)) return true;
      grid[idx] = 0;
    }
  }
  return false;
}

function solveCount(grid, limit = 2) {
  const idx = grid.findIndex(v => v === 0);
  if (idx === -1) return 1;
  let count = 0;
  for (let n = 1; n <= 9; n++) {
    if (isValid(grid, idx, n)) {
      grid[idx] = n;
      const res = solveCount(grid, limit);
      if (res > 0) count += res;
      grid[idx] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

function generatePuzzle(difficulty) {
  const grid = makeEmptyGrid();
  generateSolution(grid);
  const solution = grid.slice();
  let attempts = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 45 : difficulty === 'hard' ? 55 : 65;
  const positions = shuffle([...Array(81).keys()]);
  for (const pos of positions) {
    if (attempts <= 0) break;
    const backup = grid[pos];
    grid[pos] = 0;
    const copy = grid.slice();
    const cnt = solveCount(copy, 2);
    if (cnt !== 1) grid[pos] = backup;
    else attempts--;
  }
  return { p: grid, solution };
}

function generateBlobs() {
  const blobs = [];
  const used = new Set();
  const positions = shuffle([...Array(81).keys()]);
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ];

  for (const startPos of positions) {
    if (used.has(startPos)) continue;

    // Create a blob starting from this position
    const blob = { cells: [startPos], sum: 0, color: colors[blobs.length % colors.length] };
    used.add(startPos);

    // Randomly decide to expand the blob (40% chance for more variety)
    if (Math.random() < 0.4) {
      const r = Math.floor(startPos / 9);
      const c = startPos % 9;
      const neighbors = [
        [r-1, c], [r+1, c], [r, c-1], [r, c+1]
      ].filter(([nr, nc]) => nr >= 0 && nr < 9 && nc >= 0 && nc < 9)
       .map(([nr, nc]) => nr * 9 + nc)
       .filter(pos => !used.has(pos));

      if (neighbors.length > 0) {
        const extraCells = shuffle(neighbors).slice(0, Math.floor(Math.random() * 4) + 1);
        for (const pos of extraCells) {
          blob.cells.push(pos);
          used.add(pos);
        }
      }
    }

    // Calculate sum
    blob.sum = blob.cells.reduce((sum, pos) => sum + state.solution[pos], 0);
    blobs.push(blob);
  }

  return blobs;
}

// ---- Killer generator ----
function makeGrid(v) { return Array.from({ length: 9 }, () => Array(9).fill(v)); }

function solveGrid(grid) {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (grid[r][c] === 0) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      for (const n of nums) {
        if (isSafe(grid, r, c, n)) {
          grid[r][c] = n;
          if (solveGrid(grid)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

function isSafe(grid, r, c, n) {
  for (let i = 0; i < 9; i++) if (grid[r][i] === n || grid[i][c] === n) return false;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++)
    if (grid[rr][cc] === n) return false;
  return true;
}

function neighbors(r, c) {
  const a = [];
  if (r > 0) a.push([r - 1, c]);
  if (r < 8) a.push([r + 1, c]);
  if (c > 0) a.push([r, c - 1]);
  if (c < 8) a.push([r, c + 1]);
  return a;
}

function generateKiller(difficulty) {
  const solution = makeGrid(0);
  solveGrid(solution);

  const idGrid = makeGrid(-1);
  const cages = [];
  let id = 0;

  const SIZE_BAG = [2, 2, 2, 3, 3, 3, 4, 4, 5];
  const singletonTarget = 1 + Math.floor(Math.random() * 3);
  let singles = 0;

  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (idGrid[r][c] !== -1) continue;

    let size = SIZE_BAG[Math.floor(Math.random() * SIZE_BAG.length)];
    if (singles < singletonTarget) { size = 1; singles++; }

    const cells = [[r, c]];
    idGrid[r][c] = id;

    for (let k = 1; k < size; k++) {
      const frontier = cells.flatMap(([rr, cc]) => neighbors(rr, cc)).filter(([rr, cc]) => idGrid[rr][cc] === -1);

      if (!frontier.length) break;

      const digits = new Set(cells.map(([rr, cc]) => solution[rr][cc]));
      const valid = frontier.filter(([rr, cc]) => !digits.has(solution[rr][cc]));
      const pool = valid.length ? valid : frontier;

      pool.sort((a, b) => {
        const comp = ([rx, cx]) => -neighbors(rx, cx).filter(([nr, nc]) => idGrid[nr][nc] === id).length;
        return comp(a) - comp(b);
      });

      const [nr, nc] = pool[0];
      idGrid[nr][nc] = id;
      cells.push([nr, nc]);
    }

    const sum = cells.reduce((s, [rr, cc]) => s + solution[rr][cc], 0);
    cages.push({ id, cells: cells.map(([rr, cc]) => ({ r: rr, c: cc })), sum });
    id++;
  }

  // For killer, start with some givens based on difficulty
  const grid = makeGrid(0);
  const numGivens = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 8 : difficulty === 'hard' ? 6 : 4;
  const positions = shuffle([...Array(81).keys()]);
  for (let i = 0; i < numGivens; i++) {
    const pos = positions[i];
    const r = Math.floor(pos / 9), c = pos % 9;
    grid[r][c] = solution[r][c];
  }

  return { grid, solution, cages, idGrid };
}

// ---- UI ----
function renderGrid() {
  const cells = $$('.cell');
  cells.forEach((cell, idx) => {
    const input = cell.querySelector('input');
    const val = state.grid[idx] || '';
    input.value = val ? String(val) : '';
    cell.classList.toggle('prefill', state.prefill[idx]);
    const notesDiv = cell.querySelector('.notes');
    notesDiv.style.display = state.notes[idx] && state.notes[idx].length ? 'grid' : 'none';
    for (let n = 1; n <= 9; n++) {
      notesDiv.children[n - 1].textContent = state.notes[idx] && state.notes[idx].includes(n) ? n : '';
    }
  });
  updateConflicts();
  if (state.mode === 'killer') drawCages();
  else if (state.blobs.length > 0) drawBlobs();
}

function updateConflicts() {
  const grid = state.grid;
  $$('.cell').forEach((cell, idx) => {
    cell.classList.remove('conflict');
    const v = grid[idx];
    if (!v) return;
    const r = Math.floor(idx / 9), c = idx % 9;
    for (let i = 0; i < 9; i++) {
      if (i !== c && grid[r * 9 + i] === v) cell.classList.add('conflict');
      if (i !== r && grid[i * 9 + c] === v) cell.classList.add('conflict');
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
      const id = (br + rr) * 9 + (bc + cc);
      if (id !== idx && grid[id] === v) cell.classList.add('conflict');
    }
  });
}

function startNew() {
  state.history = [];
  state.hintsUsed = 0;
  document.body.classList.toggle('killer-mode', state.mode === 'killer');
  if (state.mode === 'killer') {
    const { grid, solution, cages, idGrid } = generateKiller(state.difficulty);
    state.grid = grid.flat();
    state.solution = solution.flat();
    state.prefill = state.grid.map(v => v ? 1 : 0);
    state.killerCages = cages;
    state.cageId = idGrid;
    state.blobs = [];
    statusEl.textContent = 'New Killer puzzle';
  } else {
    const { p, solution } = generatePuzzle(state.difficulty);
    state.grid = p.slice();
    state.solution = solution.slice();
    state.prefill = state.grid.map(v => v ? 1 : 0);
    state.killerCages = [];
    state.blobs = generateBlobs();
    statusEl.textContent = `New ${state.difficulty} ${state.mode} puzzle`;
  }
  state.notes = new Array(81).fill(null).map(() => []);
  buildBoard(); // Rebuild board with correct classes for the mode
  renderGrid();
  selectCell(0);
  currentModeEl.textContent = state.mode === 'classic' ? 'Classic' : 'Killer';
  currentDiffEl.textContent = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
}

function showMenu() {
  menuScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
}

function showGame() {
  menuScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  startNew();
}

// ---- Canvas for cages ----
function setupCageCanvas() {
  const size = CELL_SIZE * 9;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  cageCanvas.width = Math.round(size * dpr);
  cageCanvas.height = Math.round(size * dpr);
  cageCanvas.style.width = size + 'px';
  cageCanvas.style.height = size + 'px';
  const ctx = cageCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawCages() {
  const ctx = setupCageCanvas();
  const size = CELL_SIZE * 9;
  ctx.clearRect(0, 0, size, size);

  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--cage-border') || '#6b7280';
  ctx.font = '10px system-ui';

  const isColored = document.body.classList.contains('killer-mode');

  for (const cage of state.killerCages) {
    const hSegs = [];
    const vSegs = [];

    for (const { r, c } of cage.cells) {
      const x = c * CELL_SIZE + INSET;
      const y = r * CELL_SIZE + INSET;

      const sameUp = r > 0 && state.cageId[r - 1][c] === cage.id;
      const sameDown = r < 8 && state.cageId[r + 1][c] === cage.id;
      const sameLeft = c > 0 && state.cageId[r][c - 1] === cage.id;
      const sameRight = c < 8 && state.cageId[r][c + 1] === cage.id;

      if (!sameUp) hSegs.push({ y, x1: x, x2: x + CELL_SIZE - 2 * INSET });
      if (!sameDown) hSegs.push({ y: y + CELL_SIZE - 2 * INSET, x1: x, x2: x + CELL_SIZE - 2 * INSET });
      if (!sameLeft) vSegs.push({ x, y1: y, y2: y + CELL_SIZE - 2 * INSET });
      if (!sameRight) vSegs.push({ x: x + CELL_SIZE - 2 * INSET, y1: y, y2: y + CELL_SIZE - 2 * INSET });
    }

    const hRuns = mergeColinear(hSegs, 'h');
    const vRuns = mergeColinear(vSegs, 'v');

    // Fill for colorful theme
    if (isColored) {
      const tint = getComputedStyle(document.body).getPropertyValue(`--cage-tint-${cage.tint || 1}`) || 'transparent';
      ctx.fillStyle = tint;
      for (const { r, c } of cage.cells) {
        const x = c * CELL_SIZE + INSET;
        const y = r * CELL_SIZE + INSET;
        const w = CELL_SIZE - 2 * INSET;
        const h = w;
        ctx.fillRect(x, y, w, h);
      }
    }

    // Stroke borders
    for (const s of hRuns) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y);
      ctx.lineTo(s.x2, s.y);
      ctx.stroke();
    }
    for (const s of vRuns) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y1);
      ctx.lineTo(s.x, s.y2);
      ctx.stroke();
    }

    const first = cage.cells.slice().sort((a, b) => a.r === b.r ? a.c - b.c : a.r - b.r)[0];
    const tx = first.c * CELL_SIZE + INSET + 4;
    const ty = first.r * CELL_SIZE + INSET + 10;
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--cage-border') || '#6b7280';
    ctx.fillText(String(cage.sum), tx, ty);
  }
}

function mergeColinear(segs, orient) {
  const eps = 0.001;
  const out = [];
  if (segs.length === 0) return out;

  if (orient === 'h') {
    const byY = new Map();
    for (const s of segs) (byY.get(s.y) || byY.set(s.y, []).get(s.y)).push(s);
    for (const [y, arr] of byY) {
      arr.sort((a, b) => a.x1 - b.x1);
      let run = { y, x1: arr[0].x1, x2: arr[0].x2 };
      for (let i = 1; i < arr.length; i++) {
        const cur = arr[i];
        if (Math.abs(run.x2 - cur.x1) < eps) {
          run.x2 = cur.x2;
        } else {
          out.push(run);
          run = { y, x1: cur.x1, x2: cur.x2 };
        }
      }
      out.push(run);
    }
  } else {
    const byX = new Map();
    for (const s of segs) (byX.get(s.x) || byX.set(s.x, []).get(s.x)).push(s);
    for (const [x, arr] of byX) {
      arr.sort((a, b) => a.y1 - b.y1);
      let run = { x, y1: arr[0].y1, y2: arr[0].y2 };
      for (let i = 1; i < arr.length; i++) {
        const cur = arr[i];
        if (Math.abs(run.y2 - cur.y1) < eps) {
          run.y2 = cur.y2;
        } else {
          out.push(run);
          run = { x, y1: cur.y1, y2: cur.y2 };
        }
      }
      out.push(run);
    }
  }
  return out;
}

function drawBlobs() {
  const ctx = setupCageCanvas();
  const size = CELL_SIZE * 9;
  ctx.clearRect(0, 0, size, size);

  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = 'bold 10px system-ui';

  // Create a map of position to blob for easy lookup
  const posToBlob = new Map();
  state.blobs.forEach(blob => {
    blob.cells.forEach(pos => posToBlob.set(pos, blob));
  });

  for (const blob of state.blobs) {
    const hSegs = [];
    const vSegs = [];

    // Set stroke color to blob's color
    ctx.strokeStyle = blob.color;
    ctx.fillStyle = blob.color;

    // Set dashed line style
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = 0;

    for (const pos of blob.cells) {
      const r = Math.floor(pos / 9);
      const c = pos % 9;
      const x = c * CELL_SIZE + INSET;
      const y = r * CELL_SIZE + INSET;

      // Check if adjacent cells belong to same blob or blob with same sum
      const upPos = (r - 1) * 9 + c;
      const downPos = (r + 1) * 9 + c;
      const leftPos = r * 9 + (c - 1);
      const rightPos = r * 9 + (c + 1);

      const upBlob = r > 0 ? posToBlob.get(upPos) : null;
      const downBlob = r < 8 ? posToBlob.get(downPos) : null;
      const leftBlob = c > 0 ? posToBlob.get(leftPos) : null;
      const rightBlob = c < 8 ? posToBlob.get(rightPos) : null;

      const sameUp = upBlob && (upBlob === blob || upBlob.sum === blob.sum);
      const sameDown = downBlob && (downBlob === blob || downBlob.sum === blob.sum);
      const sameLeft = leftBlob && (leftBlob === blob || leftBlob.sum === blob.sum);
      const sameRight = rightBlob && (rightBlob === blob || rightBlob.sum === blob.sum);

      if (!sameUp) hSegs.push({ y, x1: x, x2: x + CELL_SIZE - 2 * INSET });
      if (!sameDown) hSegs.push({ y: y + CELL_SIZE - 2 * INSET, x1: x, x2: x + CELL_SIZE - 2 * INSET });
      if (!sameLeft) vSegs.push({ x, y1: y, y2: y + CELL_SIZE - 2 * INSET });
      if (!sameRight) vSegs.push({ x: x + CELL_SIZE - 2 * INSET, y1: y, y2: y + CELL_SIZE - 2 * INSET });
    }

    const hRuns = mergeColinear(hSegs, 'h');
    const vRuns = mergeColinear(vSegs, 'v');

    // Stroke borders
    for (const s of hRuns) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y);
      ctx.lineTo(s.x2, s.y);
      ctx.stroke();
    }
    for (const s of vRuns) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y1);
      ctx.lineTo(s.x, s.y2);
      ctx.stroke();
    }

    // Reset line dash for sum text
    ctx.setLineDash([]);

    // Draw sum if blob has more than 1 cell
    if (blob.cells.length > 1) {
      const first = blob.cells.sort((a, b) => {
        const ra = Math.floor(a / 9), rb = Math.floor(b / 9);
        const ca = a % 9, cb = b % 9;
        return ra === rb ? ca - cb : ra - rb;
      })[0];
      const r = Math.floor(first / 9);
      const c = first % 9;
      const tx = c * CELL_SIZE + INSET + 3;
      const ty = r * CELL_SIZE + INSET + 12;

      // Draw background for sum text
      const text = String(blob.sum);
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(tx - 2, ty - 10, textWidth + 4, 12);

      // Draw sum text in white
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, tx, ty);
    }
  }
}

// ---- Input ----
function onCellKeydown(e) {
  const idx = Number(e.target.parentElement.dataset.idx);
  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    handleNumber(idx, Number(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    eraseCell(idx);
  } else if (e.key.toLowerCase() === 'n') {
    notesToggle.click();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    selectCell((idx % 9 === 8) ? idx - 8 : idx + 1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    selectCell((idx % 9 === 0) ? idx + 8 : idx - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectCell((idx < 9) ? idx + 72 : idx - 9);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectCell((idx > 71) ? idx - 72 : idx + 9);
  }
}

function handleNumber(idx, num) {
  if (state.prefill[idx]) return;
  if (state.notesMode) {
    toggleNote(idx, num);
  } else {
    pushHistory();
    state.grid[idx] = num;
    state.notes[idx] = [];
    renderGrid();
  }
}

function toggleNote(idx, num) {
  if (state.prefill[idx]) return;
  const notes = state.notes[idx];
  const i = notes.indexOf(num);
  if (i >= 0) notes.splice(i, 1);
  else notes.push(num);
  notes.sort((a, b) => a - b);
  renderGrid();
}

function eraseCell(idx) {
  if (state.prefill[idx]) return;
  pushHistory();
  state.grid[idx] = 0;
  state.notes[idx] = [];
  renderGrid();
}

function pushHistory() {
  state.history.push({
    grid: state.grid.slice(),
    notes: state.notes.map(n => n.slice()),
    prefill: state.prefill.slice()
  });
  if (state.history.length > 200) state.history.shift();
}

function undo() {
  const last = state.history.pop();
  if (!last) return;
  state.grid = last.grid;
  state.notes = last.notes;
  renderGrid();
}

function checkSolution() {
  let ok = true;
  const wrong = [];
  for (let i = 0; i < 81; i++) {
    if (state.grid[i] === 0 || state.grid[i] !== state.solution[i]) {
      ok = false;
      wrong.push(i);
    }
  }
  if (ok) statusEl.textContent = 'Solved — congrats!';
  else statusEl.textContent = 'There are mistakes or empty cells.';
  $$('.cell').forEach((cell, idx) => cell.classList.toggle('conflict', wrong.includes(idx)));
}

function solveReveal() {
  pushHistory();
  state.grid = state.solution.slice();
  renderGrid();
  statusEl.textContent = 'Solution revealed';
}

function giveHint() {
  const empties = state.grid.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
  if (empties.length === 0) {
    statusEl.textContent = 'No empty cells';
    return;
  }
  const pick = empties[Math.floor(Math.random() * empties.length)];
  pushHistory();
  state.grid[pick] = state.solution[pick];
  renderGrid();
  statusEl.textContent = 'Hint applied';
  state.hintsUsed++;
}

// ---- Event listeners ----
startGameBtn.addEventListener('click', showGame);
backToMenuBtn.addEventListener('click', showMenu);
newGameBtn.addEventListener('click', startNew);
undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', giveHint);
notesToggle.addEventListener('click', () => {
  state.notesMode = !state.notesMode;
  notesToggle.setAttribute('aria-pressed', String(state.notesMode));
});
checkBtn.addEventListener('click', checkSolution);
solveBtn.addEventListener('click', solveReveal);
themeToggle.addEventListener('click', () => {
  const light = !document.body.classList.contains('light-theme');
  setTheme(light);
  themeToggle.textContent = light ? 'Dark' : 'Light';
});


modeBtns.forEach(btn => btn.addEventListener('click', () => {
  modeBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.mode = btn.dataset.mode;
}));

diffBtns.forEach(btn => btn.addEventListener('click', () => {
  diffBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.difficulty = btn.dataset.diff;
}));

numBtns.forEach(btn => btn.addEventListener('click', () => {
  if (state.selected === -1) return;
  const n = Number(btn.dataset.value);
  handleNumber(state.selected, n);
}));

eraseBtn.addEventListener('click', () => {
  if (state.selected === -1) return;
  eraseCell(state.selected);
});

// Global keyboard
document.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key >= '1' && e.key <= '9') {
    if (state.selected !== -1) handleNumber(state.selected, Number(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    if (state.selected !== -1) eraseCell(state.selected);
  } else if (e.key.toLowerCase() === 'n') {
    notesToggle.click();
  }
});

// Init
buildBoard();
showMenu();
window.addEventListener('resize', () => {
  if (state.mode === 'killer') drawCages();
  else if (state.blobs.length > 0) drawBlobs();
});