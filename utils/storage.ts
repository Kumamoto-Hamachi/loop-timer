import { storage } from '#imports';
import { DEFAULT_SETTINGS, IDLE_STATE, type TimerSettings, type TimerState } from './timer';

/** 設定はブラウザを再起動しても残す */
export const settingsItem = storage.defineItem<TimerSettings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** ブラウザを閉じたらループも終わるように、状態は session に置く */
export const timerStateItem = storage.defineItem<TimerState>('session:timerState', {
  fallback: IDLE_STATE,
});
