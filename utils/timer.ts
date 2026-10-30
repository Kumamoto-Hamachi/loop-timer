/**
 * タイマーの状態遷移(副作用なしの純粋関数)
 *
 *   idle --start--> work --elapsed--> workEnded --dismiss--> rest --elapsed--> restEnded --dismiss--> work ...
 *   (どの状態からでも stop で idle に戻る)
 */

export type Phase = 'idle' | 'work' | 'workEnded' | 'rest' | 'restEnded';

export interface TimerState {
  phase: Phase;
  /** 現フェーズの終了予定時刻(epoch ms)。work / rest のときだけ値を持つ */
  endsAt: number | null;
}

export interface TimerSettings {
  workMinutes: number;
  restSeconds: number;
}

/**
 * - start: ループを開始する
 * - elapsed: 作業 / 休憩の時間が経過した
 * - dismiss: 鳴っているタイマーを止める(次のフェーズへ進む)
 * - stop: ループを完全に止める
 */
export type TimerEvent = 'start' | 'elapsed' | 'dismiss' | 'stop';

export const DEFAULT_SETTINGS: TimerSettings = { workMinutes: 15, restSeconds: 30 };

export const IDLE_STATE: TimerState = { phase: 'idle', endsAt: null };

export function isRinging(phase: Phase): phase is 'workEnded' | 'restEnded' {
  return phase === 'workEnded' || phase === 'restEnded';
}

export function transition(
  state: TimerState,
  event: TimerEvent,
  settings: TimerSettings,
  now: number,
): TimerState {
  const startWork = (): TimerState => ({ phase: 'work', endsAt: now + settings.workMinutes * 60_000 });
  const startRest = (): TimerState => ({ phase: 'rest', endsAt: now + settings.restSeconds * 1_000 });

  switch (event) {
    case 'start':
      return state.phase === 'idle' ? startWork() : state;
    case 'elapsed':
      if (state.phase === 'work') return { phase: 'workEnded', endsAt: null };
      if (state.phase === 'rest') return { phase: 'restEnded', endsAt: null };
      return state;
    case 'dismiss':
      if (state.phase === 'workEnded') return startRest();
      if (state.phase === 'restEnded') return startWork();
      return state;
    case 'stop':
      return IDLE_STATE;
  }
}
