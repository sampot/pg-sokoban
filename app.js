import { SokobanAudio } from "./audio.js";
import { SokobanGame } from "./game.js";

const BEST_KEY = "pg-sokoban-best";
const CELL = 36;

const audio = new SokobanAudio();
const game = new SokobanGame();

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("game"));
const ctx = canvas.getContext("2d");
const levelEl = document.getElementById("level");
const nameEl = document.getElementById("level-name");
const movesEl = document.getElementById("moves");
const pushesEl = document.getElementById("pushes");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnUndo = document.getElementById("btn-undo");
const btnReset = document.getElementById("btn-reset");
const btnMute = document.getElementById("btn-mute");
const winPanel = document.getElementById("win-panel");
const winText = document.getElementById("win-text");
const btnWinNext = document.getElementById("btn-win-next");
const btnWinClose = document.getElementById("btn-win-close");

/** @type {Record<string, number>} */
let bests = loadBests();

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveBests() {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(bests));
  } catch {
    /* */
  }
}

/** @param {string} msg @param {string} [tone] */
function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  levelEl.textContent = `${game.levelIndex + 1}/${game.levelCount}`;
  nameEl.textContent = game.levelName();
  movesEl.textContent = String(game.moves);
  pushesEl.textContent = String(game.pushes);
  const b = bests[String(game.levelIndex)];
  bestEl.textContent = b != null ? String(b) : "—";
  btnPrev.disabled = game.levelIndex <= 0;
  btnNext.disabled = game.levelIndex >= game.levelCount - 1;
  btnUndo.disabled = game.status === "ready" || !game.undoStack.length;
  winPanel.hidden = game.status !== "won";
}

function resize() {
  const maxW = Math.min(360, window.innerWidth - 28);
  const cell = Math.max(22, Math.min(CELL, Math.floor(maxW / Math.max(1, game.w))));
  canvas.width = game.w * cell;
  canvas.height = game.h * cell;
  canvas.dataset.cell = String(cell);
}

function draw() {
  if (!ctx || !game.w) return;
  const cell = Number(canvas.dataset.cell || CELL);
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  ctx.fillStyle = dark ? "#141a14" : "#dfe8df";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < game.h; y++) {
    for (let x = 0; x < game.w; x++) {
      const c = game.board[y][x];
      const px = x * cell;
      const py = y * cell;
      if (c.wall) {
        const g = ctx.createLinearGradient(px, py, px + cell, py + cell);
        g.addColorStop(0, dark ? "#3f4a3f" : "#6b7a6b");
        g.addColorStop(1, dark ? "#252c25" : "#4a574a");
        ctx.fillStyle = g;
        ctx.fillRect(px, py, cell, cell);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        continue;
      }
      ctx.fillStyle = dark ? "#1c241c" : "#eef5ee";
      ctx.fillRect(px, py, cell, cell);
      if (c.goal) {
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#f59e0b" : "#d97706";
        ctx.fill();
      }
      if (c.box) {
        const pad = cell * 0.14;
        const g = ctx.createLinearGradient(px, py, px + cell, py + cell);
        g.addColorStop(0, c.goal ? "#86efac" : "#c4a574");
        g.addColorStop(1, c.goal ? "#15803d" : "#8b6914");
        ctx.fillStyle = g;
        roundRect(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.stroke();
      }
    }
  }

  const ppx = game.player.x * cell;
  const ppy = game.player.y * cell;
  ctx.beginPath();
  ctx.arc(ppx + cell / 2, ppy + cell / 2, cell * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "#38bdf8" : "#0284c7";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(ppx + cell * 0.4, ppy + cell * 0.38, cell * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function onWin() {
  const key = String(game.levelIndex);
  const prev = bests[key];
  if (prev == null || game.moves < prev) {
    bests[key] = game.moves;
    saveBests();
  }
  winText.textContent = `${game.levelName()}完成：${game.moves} 步、${game.pushes} 次推動`;
  audio.win();
  setStatus(game.message, "ok");
  syncHud();
}

/**
 * @param {number} dx
 * @param {number} dy
 */
async function move(dx, dy) {
  await audio.unlock();
  const r = game.tryMove(dx, dy);
  if (!r.ok) audio.bump();
  else if (r.pushed) audio.push();
  else audio.step();
  if (game.status === "won") onWin();
  else if (game.message) setStatus(game.message);
  syncHud();
  draw();
}

function startLevel(i) {
  game.load(i);
  resize();
  setStatus(game.message);
  syncHud();
  draw();
}

btnPrev.addEventListener("click", async () => {
  await audio.unlock();
  audio.click();
  if (game.levelIndex > 0) startLevel(game.levelIndex - 1);
});
btnNext.addEventListener("click", async () => {
  await audio.unlock();
  audio.click();
  if (game.levelIndex < game.levelCount - 1) startLevel(game.levelIndex + 1);
});
btnUndo.addEventListener("click", async () => {
  await audio.unlock();
  if (game.undo()) {
    audio.undo();
    setStatus(game.message);
    syncHud();
    draw();
  }
});
btnReset.addEventListener("click", async () => {
  await audio.unlock();
  audio.click();
  game.reset();
  setStatus(game.message, "warn");
  syncHud();
  draw();
});
btnMute.addEventListener("click", async () => {
  await audio.unlock();
  const on = btnMute.getAttribute("aria-pressed") !== "true";
  btnMute.setAttribute("aria-pressed", on ? "true" : "false");
  btnMute.textContent = on ? "音效" : "靜音";
  audio.setEnabled(on);
  audio.click();
});
btnWinNext.addEventListener("click", async () => {
  await audio.unlock();
  audio.click();
  if (game.levelIndex < game.levelCount - 1) startLevel(game.levelIndex + 1);
  else {
    winPanel.hidden = true;
    setStatus("全部關卡完成！", "ok");
  }
});
btnWinClose.addEventListener("click", async () => {
  await audio.unlock();
  audio.click();
  winPanel.hidden = true;
});

for (const b of document.querySelectorAll("[data-dir]")) {
  b.addEventListener("click", () => {
    const [dx, dy] = (/** @type {HTMLElement} */ (b).dataset.dir || "0,0").split(",").map(Number);
    void move(dx, dy);
  });
}

window.addEventListener("keydown", (ev) => {
  const map = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    z: "undo",
    Z: "undo",
    u: "undo",
    U: "undo",
    r: "reset",
    R: "reset",
  };
  const v = map[ev.key];
  if (!v) return;
  ev.preventDefault();
  if (v === "undo") {
    void btnUndo.click();
    return;
  }
  if (v === "reset") {
    void btnReset.click();
    return;
  }
  void move(v[0], v[1]);
});

/** swipe */
let touchX = 0;
let touchY = 0;
canvas.addEventListener(
  "touchstart",
  (ev) => {
    const t = ev.changedTouches[0];
    touchX = t.clientX;
    touchY = t.clientY;
  },
  { passive: true },
);
canvas.addEventListener(
  "touchend",
  (ev) => {
    const t = ev.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) void move(dx > 0 ? 1 : -1, 0);
    else void move(0, dy > 0 ? 1 : -1);
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  resize();
  draw();
});

startLevel(0);
