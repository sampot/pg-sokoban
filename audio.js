/** Sokoban SFX — original Web Audio tones. */

export class SokobanAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.22;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "triangle", gain = 0.1, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  click() {
    this.tone(500, 0.04, "triangle", 0.05);
  }
  step() {
    this.tone(260, 0.04, "sine", 0.04);
  }
  push() {
    this.tone(180, 0.07, "square", 0.05);
    this.tone(140, 0.08, "triangle", 0.04, 0.04);
  }
  bump() {
    this.tone(110, 0.05, "sawtooth", 0.03);
  }
  undo() {
    this.tone(400, 0.05, "sine", 0.04);
    this.tone(320, 0.06, "sine", 0.03, 0.04);
  }
  win() {
    this.tone(523, 0.08, "sine", 0.07);
    this.tone(659, 0.08, "sine", 0.07, 0.08);
    this.tone(784, 0.16, "triangle", 0.08, 0.16);
  }
}
