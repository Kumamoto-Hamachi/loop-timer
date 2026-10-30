import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, IDLE_STATE, transition, type Phase, type TimerState } from './timer';

const NOW = 1_000_000;
const WORK_MS = 15 * 60_000;
const REST_MS = 30_000;

const stateOf = (phase: Phase): TimerState => ({
  phase,
  endsAt: phase === 'work' || phase === 'rest' ? NOW + 5_000 : null,
});

describe('transition', () => {
  it('idle で start すると作業タイマーが始まる', () => {
    expect(transition(IDLE_STATE, 'start', DEFAULT_SETTINGS, NOW)).toEqual({ phase: 'work', endsAt: NOW + WORK_MS });
  });

  it.each<Phase>(['work', 'workEnded', 'rest', 'restEnded'])('%s で start しても何も変わらない', (phase) => {
    const state = stateOf(phase);
    expect(transition(state, 'start', DEFAULT_SETTINGS, NOW)).toBe(state);
  });

  it.each<[Phase, Phase]>([
    ['work', 'workEnded'],
    ['rest', 'restEnded'],
  ])('%s の時間が経過すると %s になって鳴る', (from, to) => {
    expect(transition(stateOf(from), 'elapsed', DEFAULT_SETTINGS, NOW)).toEqual({ phase: to, endsAt: null });
  });

  it.each<Phase>(['idle', 'workEnded', 'restEnded'])('%s で elapsed が来ても何も変わらない', (phase) => {
    const state = stateOf(phase);
    expect(transition(state, 'elapsed', DEFAULT_SETTINGS, NOW)).toBe(state);
  });

  it.each<[Phase, TimerState]>([
    ['workEnded', { phase: 'rest', endsAt: NOW + REST_MS }],
    ['restEnded', { phase: 'work', endsAt: NOW + WORK_MS }],
  ])('%s で止めると次のタイマーが始まる', (from, expected) => {
    expect(transition(stateOf(from), 'dismiss', DEFAULT_SETTINGS, NOW)).toEqual(expected);
  });

  it.each<Phase>(['idle', 'work', 'rest'])('%s で dismiss しても何も変わらない', (phase) => {
    const state = stateOf(phase);
    expect(transition(state, 'dismiss', DEFAULT_SETTINGS, NOW)).toBe(state);
  });

  it.each<Phase>(['idle', 'work', 'workEnded', 'rest', 'restEnded'])('%s で stop するとループが止まる', (phase) => {
    expect(transition(stateOf(phase), 'stop', DEFAULT_SETTINGS, NOW)).toEqual(IDLE_STATE);
  });

  it('設定した時間が使われる', () => {
    const settings = { workMinutes: 25, restSeconds: 300 };
    const work = transition(IDLE_STATE, 'start', settings, NOW);
    const rest = transition(transition(work, 'elapsed', settings, NOW), 'dismiss', settings, NOW);
    expect(work.endsAt).toBe(NOW + 25 * 60_000);
    expect(rest.endsAt).toBe(NOW + 300_000);
  });

  it('作業 → 鳴る → 休憩 → 鳴る → 作業 とループする', () => {
    const events = ['start', 'elapsed', 'dismiss', 'elapsed', 'dismiss', 'elapsed'] as const;
    const phases: Phase[] = [];
    let state = IDLE_STATE;
    for (const event of events) {
      state = transition(state, event, DEFAULT_SETTINGS, NOW);
      phases.push(state.phase);
    }
    expect(phases).toEqual(['work', 'workEnded', 'rest', 'restEnded', 'work', 'workEnded']);
  });
});
