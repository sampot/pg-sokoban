/**
 * Sokoban engine — undo stack, win check.
 */

import { LEVELS } from "./levels.js";

/**
 * @typedef {{ wall: boolean, goal: boolean, box: boolean }[][]} Board
 * @typedef {{ x: number, y: number }} Pt
 */

export class SokobanGame {
  constructor() {
    this.levelIndex = 0;
    this.moves = 0;
    this.pushes = 0;
    /** @type {Board} */
    this.board = [];
    /** @type {Pt} */
    this.player = { x: 0, y: 0 };
    this.w = 0;
    this.h = 0;
    /** @type {'ready'|'playing'|'won'} */
    this.status = "ready";
    this.message = "選關後開始";
    /** @type {{ board: Board, player: Pt, moves: number, pushes: number }[]} */
    this.undoStack = [];
  }

  get levelCount() {
    return LEVELS.length;
  }

  levelName() {
    return LEVELS[this.levelIndex]?.name || "";
  }

  /** @param {number} index */
  load(index) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, index));
    const lv = LEVELS[i];
    this.levelIndex = i;
    const parsed = parseMap(lv.map);
    this.board = parsed.board;
    this.player = parsed.player;
    this.w = parsed.w;
    this.h = parsed.h;
    this.moves = 0;
    this.pushes = 0;
    this.undoStack = [];
    this.status = "playing";
    this.message = `${lv.name} · 推箱子到點`;
  }

  reset() {
    this.load(this.levelIndex);
    this.message = "本關重來";
  }

  snapshot() {
    return {
      board: this.board.map((row) => row.map((c) => ({ ...c }))),
      player: { ...this.player },
      moves: this.moves,
      pushes: this.pushes,
    };
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev || this.status === "ready") return false;
    this.board = prev.board;
    this.player = prev.player;
    this.moves = prev.moves;
    this.pushes = prev.pushes;
    this.status = "playing";
    this.message = "已復原一步";
    return true;
  }

  /**
   * @param {number} dx
   * @param {number} dy
   */
  tryMove(dx, dy) {
    if (this.status !== "playing") return { ok: false, pushed: false };
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (!inBounds(this, nx, ny) || this.board[ny][nx].wall) return { ok: false, pushed: false };

    const snap = this.snapshot();
    if (this.board[ny][nx].box) {
      const bx = nx + dx;
      const by = ny + dy;
      if (!inBounds(this, bx, by) || this.board[by][bx].wall || this.board[by][bx].box) {
        return { ok: false, pushed: false };
      }
      this.undoStack.push(snap);
      this.board[ny][nx].box = false;
      this.board[by][bx].box = true;
      this.player = { x: nx, y: ny };
      this.moves += 1;
      this.pushes += 1;
      if (this.checkWin()) {
        this.status = "won";
        this.message = `過關！${this.moves} 步 · ${this.pushes} 推`;
      } else {
        this.message = "推！";
      }
      return { ok: true, pushed: true };
    }

    this.undoStack.push(snap);
    this.player = { x: nx, y: ny };
    this.moves += 1;
    this.message = "";
    return { ok: true, pushed: false };
  }

  checkWin() {
    for (const row of this.board) {
      for (const c of row) {
        if (c.goal && !c.box) return false;
      }
    }
    return true;
  }
}

/**
 * @param {string[]} lines
 */
function parseMap(lines) {
  const h = lines.length;
  const w = Math.max(...lines.map((l) => [...l].length));
  /** @type {Board} */
  const board = [];
  /** @type {Pt} */
  let player = { x: 0, y: 0 };
  for (let y = 0; y < h; y++) {
    const chars = [...lines[y].padEnd(w, " ")];
    /** @type {Board[0]} */
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = chars[x];
      const cell = { wall: false, goal: false, box: false };
      if (ch === "#") cell.wall = true;
      else if (ch === ".") cell.goal = true;
      else if (ch === "$") cell.box = true;
      else if (ch === "*") {
        cell.box = true;
        cell.goal = true;
      } else if (ch === "@") player = { x, y };
      else if (ch === "+") {
        player = { x, y };
        cell.goal = true;
      }
      row.push(cell);
    }
    board.push(row);
  }
  return { board, player, w, h };
}

/**
 * @param {SokobanGame} g
 * @param {number} x
 * @param {number} y
 */
function inBounds(g, x, y) {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}
