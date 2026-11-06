// Notification sounds, made in the browser so there are no audio files to host.
// Browsers keep sound blocked until someone clicks or presses a key on the page,
// so anything that arrives before that plays on the first click.
let ctx = null;
let pending = null;

function context() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  return ctx;
}

function tone(c, frequency, start, length, volume) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  const at = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function play(c, kind) {
  if (kind === 'urgent') {
    [0, 0.28, 0.56, 1.1, 1.38, 1.66].forEach((start) => tone(c, 988, start, 0.22, 0.6));
  } else {
    tone(c, 784, 0, 0.3, 0.35);
    tone(c, 1047, 0.18, 0.45, 0.35);
  }
}

function flush(c) {
  if (!pending || c.state !== 'running') return;
  const kind = pending;
  pending = null;
  play(c, kind);
}

// kind: 'chime' for everyday notifications, 'urgent' for orders getting late
export function playAlert(kind = 'chime') {
  const c = context();
  if (!c) return;
  if (pending !== 'urgent') pending = kind;
  if (c.state === 'running') flush(c);
  else c.resume().then(() => flush(c)).catch(() => {});
}

function unlock() {
  const c = context();
  if (c && c.state !== 'running') c.resume().then(() => flush(c)).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}