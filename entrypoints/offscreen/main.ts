/**
 * background から開かれている間だけアラーム音をループ再生する。
 * 止めるときは background がこの document ごと閉じる。
 */

interface Beep {
  frequency: number;
  /** パターン先頭からの開始位置(秒) */
  at: number;
  duration: number;
}

/** 1 回分のパターン。止められるまで繰り返す */
const PATTERNS: Record<'workEnded' | 'restEnded', { beeps: Beep[]; length: number }> = {
  // 作業終了: 高めの「ピピッ」
  workEnded: {
    beeps: [
      { frequency: 988, at: 0, duration: 0.12 },
      { frequency: 988, at: 0.18, duration: 0.12 },
    ],
    length: 1.0,
  },
  // 休憩終了: 上がっていく「ピポパ」
  restEnded: {
    beeps: [
      { frequency: 659, at: 0, duration: 0.12 },
      { frequency: 784, at: 0.16, duration: 0.12 },
      { frequency: 988, at: 0.32, duration: 0.2 },
    ],
    length: 1.2,
  },
};

const VOLUME = 0.3;
/** 音の立ち上がり・終わりのプツッというノイズを消すためのフェード時間(秒) */
const FADE = 0.005;

const phase = new URLSearchParams(location.search).get('phase') === 'restEnded' ? 'restEnded' : 'workEnded';
const { beeps, length } = PATTERNS[phase];

const context = new AudioContext();
const buffer = context.createBuffer(1, Math.round(length * context.sampleRate), context.sampleRate);
const samples = buffer.getChannelData(0);

for (const beep of beeps) {
  const offset = Math.round(beep.at * context.sampleRate);
  const count = Math.round(beep.duration * context.sampleRate);
  for (let i = 0; i < count; i++) {
    const t = i / context.sampleRate;
    const envelope = Math.min(1, t / FADE, (beep.duration - t) / FADE);
    samples[offset + i] = VOLUME * envelope * Math.sin(2 * Math.PI * beep.frequency * t);
  }
}

const source = context.createBufferSource();
source.buffer = buffer;
source.loop = true;
source.connect(context.destination);
source.start();
