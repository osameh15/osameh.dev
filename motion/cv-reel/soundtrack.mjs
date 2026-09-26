// Composes and synthesizes the reel's original soundtrack -> soundtrack.wav
//
//   node motion/cv-reel/soundtrack.mjs
//
// A 30-second, 120 BPM electronic "tech" cue in A minor, written for this reel
// and rendered sample by sample with no dependencies or samples, so it carries
// no third-party licence. Drums, bass, arpeggio, pad and lead come from simple
// oscillators; key-clicks, risers and impacts are cued to the picture.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const DUR = 30;
const N = SR * DUR;
const BEAT = 0.5;           // 120 BPM
const S16 = BEAT / 4;
const BAR = BEAT * 4;

// Scene cuts, mirrored from the `scenes` table in index.html.
const CUTS = [4.5, 9.0, 16.5, 21.5, 26.0];
// Keystrokes of "whoami --verbose" typed at 26 chars/s from 0.25 s.
const KEYS = Array.from({ length: 16 }, (_, i) => 0.25 + i / 26);

/* ---------- utilities ---------- */
const L = new Float32Array(N), R = new Float32Array(N);        // dry mix
const RL = new Float32Array(N), RR = new Float32Array(N);      // reverb send
const DL = new Float32Array(N), DR = new Float32Array(N);      // delay send
const mtof = m => 440 * 2 ** ((m - 69) / 12);
let seed = 1;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const smooth = x => x * x * (3 - 2 * x);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Zero-delay-feedback state-variable filter; call per sample with a cutoff. */
function svf() {
  let ic1 = 0, ic2 = 0;
  return (x, fc, q = 0.7) => {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
  };
}
function put(i, v, pan = 0, rev = 0, dly = 0) {
  if (i < 0 || i >= N) return;
  const l = v * Math.cos((pan + 1) * Math.PI / 4), r = v * Math.sin((pan + 1) * Math.PI / 4);
  L[i] += l; R[i] += r; RL[i] += l * rev; RR[i] += r * rev; DL[i] += l * dly; DR[i] += r * dly;
}
/** Level automation across the arrangement (0..1), per part. */
function section(t) {
  if (t < CUTS[0]) return "intro";
  if (t < CUTS[1]) return "groove";
  if (t < CUTS[2]) return "drive";
  if (t < CUTS[3]) return "lift";
  if (t < CUTS[4]) return "drive2";
  return "outro";
}
const drumsOn = t => t >= CUTS[0] && t < CUTS[4];

/* ---------- harmony: Am7 · Fmaj7 · C · G, one chord per bar ---------- */
const CHORDS = [
  { bass: 45, pad: [57, 60, 64, 67] },
  { bass: 41, pad: [53, 57, 60, 64] },
  { bass: 48, pad: [55, 60, 64, 67] },
  { bass: 43, pad: [55, 59, 62, 67] },
];
const chordAt = t => CHORDS[Math.floor(t / BAR) % 4];

/* ---------- sidechain: everything melodic ducks under the kick ---------- */
const kicks = [];
for (let t = CUTS[0]; t < CUTS[4] - 1e-6; t += BEAT) kicks.push(t);
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  for (let i = Math.floor(k * SR), j = 0; j < SR * 0.3 && i + j < N; j++) {
    const d = 1 - 0.65 * Math.exp(-j / SR / 0.09);
    duck[i + j] = Math.min(duck[i + j], d);
  }
}

/* ---------- pad: detuned saws through a slowly opening filter ---------- */
{
  const fl = svf(), fr = svf();
  const voices = [];
  for (let v = 0; v < 4; v++) for (const det of [-0.11, 0, 0.12]) voices.push({ v, det, ph: (v * 3 + det * 10 + 5) % 1 });
  for (let i = 0; i < N; i++) {
    const t = i / SR, ch = chordAt(t);
    let l = 0, r = 0;
    voices.forEach((o, n) => {
      o.ph += mtof(ch.pad[o.v] + o.det) / SR; o.ph -= Math.floor(o.ph);
      const s = 2 * o.ph - 1;
      if (n % 2) l += s; else r += s;
    });
    const sec = section(t);
    const lvl = sec === "intro" ? smooth(clamp(t / 2)) * 1.7 : sec === "outro" ? 1.2 : 0.75;
    const cut = sec === "intro" ? 300 + 900 * clamp(t / 4.5) : sec === "outro" ? 2200 - 1400 * clamp((t - CUTS[4]) / 4) : 1600 + 500 * Math.sin(t * 0.8);
    const g = 0.03 * lvl * (0.4 + 0.6 * duck[i]);
    const yl = fl(l, cut, 0.9).lp * g, yr = fr(r, cut, 0.9).lp * g;
    L[i] += yl; R[i] += yr; RL[i] += yl * 0.6; RR[i] += yr * 0.6;
  }
}

/* ---------- arpeggio: plucked saw/square, 16ths, ping-pong delay ---------- */
{
  const PATTERN = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2];
  const f = svf();
  let ph = 0, note = 69, env = 0, step = -1;
  for (let i = 0; i < N; i++) {
    const t = i / SR, sec = section(t);
    const s = Math.floor(t / S16);
    if (t >= 1.0 && s !== step) {
      step = s;
      const ch = chordAt(t);
      note = ch.pad[PATTERN[s % 16]] + 12 + (s % 32 >= 24 ? 12 : 0);
      env = s % 4 === 0 ? 1 : 0.7;
    }
    env *= Math.exp(-1 / SR / 0.11);
    ph += mtof(note) / SR; ph -= Math.floor(ph);
    const osc = (2 * ph - 1) * 0.6 + (ph < 0.5 ? 0.4 : -0.4);
    const open = sec === "intro" ? 500 + 1500 * clamp((t - 1) / 3.5)
      : sec === "groove" ? 2200 : sec === "outro" ? 2600 - 1800 * clamp((t - CUTS[4]) / 4) : 3800;
    const y = f(osc, open * (0.5 + env), 2.2).lp;
    const lvl = sec === "intro" ? 1.2 : sec === "outro" ? 0.8 * (1 - clamp((t - CUTS[4]) / 4)) : 1;
    put(i, y * env * 0.075 * lvl * duck[i], Math.sin(t * 1.3) * 0.35, 0.25, 0.4);
  }
}

/* ---------- bass: sine + driven saw, off-beat 8ths ---------- */
{
  const f = svf();
  let ph = 0, env = 0, note = 45, step = -1;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (!drumsOn(t)) { env *= 0.999; }
    const s = Math.floor(t / (BEAT / 2));
    if (drumsOn(t) && s !== step) {
      step = s;
      note = chordAt(t).bass + (s % 2 ? 12 : 0);
      env = s % 2 ? 1 : 0.55;
    }
    env *= Math.exp(-1 / SR / 0.16);
    ph += mtof(note) / SR; ph -= Math.floor(ph);
    const saw = Math.tanh(3 * (2 * ph - 1));
    const y = Math.sin(2 * Math.PI * ph) * 0.8 + f(saw, 500 + 1400 * env, 1.4).lp * 0.5;
    put(i, y * env * 0.16 * duck[i], 0, 0.02);
  }
}

/* ---------- drums ---------- */
function kick(t0, amp = 1) {
  let ph = 0;
  for (let j = 0; j < SR * 0.45; j++) {
    const tt = j / SR;
    ph += (45 + 110 * Math.exp(-tt / 0.035)) / SR;
    const click = j < SR * 0.004 ? noise() * 0.3 * (1 - j / (SR * 0.004)) : 0;
    put(Math.floor(t0 * SR) + j, (Math.sin(2 * Math.PI * ph) * Math.exp(-tt / 0.22) + click) * 0.42 * amp, 0, 0.02);
  }
}
function hat(t0, amp, open = false, pan = 0.2) {
  const f = svf();
  const dec = open ? 0.12 : 0.03;
  for (let j = 0; j < SR * dec * 5; j++) {
    const y = f(noise(), 8500, 0.8).hp;
    put(Math.floor(t0 * SR) + j, y * Math.exp(-j / SR / dec) * 0.06 * amp, pan, 0.1);
  }
}
function clap(t0, amp = 1) {
  const f = svf();
  for (let j = 0; j < SR * 0.35; j++) {
    const tt = j / SR;
    const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (tt >= o ? Math.exp(-(tt - o) / 0.009) : 0), 0);
    const tail = Math.exp(-tt / 0.12) * 0.5;
    const y = f(noise(), 1500, 1.1).bp * (bursts + tail);
    put(Math.floor(t0 * SR) + j, y * 0.22 * amp, 0, 0.35);
  }
}
for (let t = CUTS[0]; t < CUTS[4] - 1e-6; t += S16) {
  const s = Math.round((t - CUTS[0]) / S16), sec = section(t);
  if (s % 4 === 0) kick(t, s % 16 === 0 ? 1.05 : 1);
  if (s % 4 === 2) hat(t, 1, s % 8 === 6 && sec !== "groove", -0.15);
  if (sec !== "groove" && s % 4 !== 2) hat(t, s % 2 ? 0.45 : 0.3, false, 0.25);
  if (sec !== "groove" && s % 8 === 4) clap(t);
}

/* ---------- lead: bell motif over the skills scene ---------- */
{
  // A-minor pentatonic phrase, [16th step, midi, length in 16ths]
  const PHRASE = [[0, 76, 3], [3, 79, 3], [6, 81, 2], [8, 84, 4], [12, 81, 2], [14, 79, 2],
                  [16, 76, 3], [19, 74, 3], [22, 72, 2], [24, 74, 4], [28, 76, 4]];
  const start = CUTS[2];
  for (let rep = 0; rep < 2; rep++) {
    for (const [st, m, len] of PHRASE) {
      const t0 = start + (rep * 32 + st) * S16;
      if (t0 >= CUTS[3]) continue;
      const f = mtof(m);
      for (let j = 0; j < SR * (len * S16 + 0.6); j++) {
        const tt = j / SR;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.35);
        const y = Math.sin(2 * Math.PI * f * tt + 1.4 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt / 0.2)) + 0.3 * Math.sin(2 * Math.PI * f * 2 * tt);
        const i = Math.floor(t0 * SR) + j;
        put(i, y * env * 0.05 * (i < N ? duck[i] : 1), 0.15, 0.35, 0.45);
      }
    }
  }
}

/* ---------- sound design cued to the picture ---------- */
// keyboard clicks while "whoami --verbose" types
KEYS.forEach((t0, n) => {
  const f = svf();
  for (let j = 0; j < SR * 0.03; j++) {
    const y = f(noise(), 3000 + (n % 3) * 700, 1.5).bp;
    put(Math.floor(t0 * SR) + j, y * Math.exp(-j / SR / 0.006) * 0.28, (n % 2 ? 0.2 : -0.2), 0.05);
  }
});
// risers into each cut, impacts on each cut
CUTS.forEach((c, n) => {
  const f = svf();
  const len = n === 0 ? 1.4 : 0.9;
  for (let j = 0; j < SR * len; j++) {
    const p = j / (SR * len);
    const y = f(noise(), 400 + 7000 * p * p, 2.5).bp;
    put(Math.floor((c - len) * SR) + j, y * p * p * 0.1, Math.sin(p * 6) * 0.5, 0.4);
  }
  const big = n === 0 || n === CUTS.length - 1 ? 1.3 : 1;
  const fn = svf();
  let ph = 0;
  for (let j = 0; j < SR * 1.6; j++) {
    const tt = j / SR;
    ph += (38 + 70 * Math.exp(-tt / 0.08)) / SR;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-tt / 0.5) * 0.5;
    const crash = fn(noise(), 5000, 0.7).hp * Math.exp(-tt / 0.45) * 0.12;
    put(Math.floor(c * SR) + j, (boom + crash) * big, 0, 0.5);
  }
  // a quick filtered whoosh riding the on-screen wipe
  const fw = svf();
  for (let j = 0; j < SR * 0.55; j++) {
    const p = j / (SR * 0.55);
    const y = fw(noise(), 800 + 5000 * Math.sin(Math.PI * p), 1.8).bp;
    put(Math.floor((c - 0.275) * SR) + j, y * Math.sin(Math.PI * p) * 0.08, -0.8 + 1.6 * p, 0.2);
  }
});
// final sustained chord to close on the contact card
{
  const notes = [45, 57, 64, 67, 72, 76];
  for (const m of notes) {
    let ph = 0;
    for (let j = 0; j < SR * 4; j++) {
      const tt = j / SR;
      ph += mtof(m) / SR;
      const env = Math.min(1, tt / 0.02) * Math.exp(-tt / 1.6);
      put(Math.floor(CUTS[4] * SR) + j, Math.sin(2 * Math.PI * ph) * env * 0.035, (m % 5) / 5 - 0.4, 0.6);
    }
  }
}

/* ---------- effects: ping-pong delay (3/16) and Freeverb-style reverb ---------- */
{
  const d = Math.floor(S16 * 3 * SR);
  const bl = new Float32Array(d), br = new Float32Array(d);
  const lp = svf(), rp = svf();
  for (let i = 0, w = 0; i < N; i++, w = (w + 1) % d) {
    const ol = bl[w], or = br[w];
    bl[w] = DL[i] + lp(or, 3500).lp * 0.42;
    br[w] = DR[i] + rp(ol, 3500).lp * 0.42;
    L[i] += ol * 0.5; R[i] += or * 0.5;
    RL[i] += ol * 0.2; RR[i] += or * 0.2;
  }
}
function freeverb(input, spread) {
  const scale = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(n => ({ b: new Float32Array(Math.floor((n + spread) * scale)), i: 0, s: 0 }));
  const aps = [556, 441, 341, 225].map(n => ({ b: new Float32Array(Math.floor((n + spread) * scale)), i: 0 }));
  const out = new Float32Array(N), fb = 0.86, damp = 0.3;
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.s = o * (1 - damp) + c.s * damp;
      c.b[c.i] = x + c.s * fb;
      c.i = (c.i + 1) % c.b.length;
      y += o;
    }
    for (const a of aps) {
      const o = a.b[a.i];
      a.b[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.b.length;
      y = o - y;
    }
    out[n] = y;
  }
  return out;
}
const wl = freeverb(RL, 0), wr = freeverb(RR, 23);
for (let i = 0; i < N; i++) { L[i] += wl[i] * 0.9; R[i] += wr[i] * 0.9; }

/* ---------- master: gentle glue, soft clip, fades, normalise ---------- */
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * (t > DUR - 1.5 ? smooth((DUR - t) / 1.5) : 1);
  L[i] = Math.tanh(L[i] * 1.4) * fade;
  R[i] = Math.tanh(R[i] * 1.4) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak; // -1 dBFS

/* ---------- write 16-bit stereo WAV ---------- */
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(clamp(L[i] * gain, -1, 1) * 32767), i * 4);
  data.writeInt16LE(Math.round(clamp(R[i] * gain, -1, 1) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(data.length, 40);
const out = join(dirname(fileURLToPath(import.meta.url)), "soundtrack.wav");
writeFileSync(out, Buffer.concat([header, data]));
console.log(`wrote ${out} (peak normalised from ${peak.toFixed(3)})`);
