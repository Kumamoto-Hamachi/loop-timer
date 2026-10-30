import { browser } from '#imports';
import type { TimerEvent } from './timer';

export interface TimerMessage {
  type: 'timer';
  event: TimerEvent;
}

export function isTimerMessage(message: unknown): message is TimerMessage {
  return typeof message === 'object' && message !== null && (message as TimerMessage).type === 'timer';
}

/** popup から background にイベントを送る */
export async function sendTimerEvent(event: TimerEvent): Promise<void> {
  const message: TimerMessage = { type: 'timer', event };
  await browser.runtime.sendMessage(message);
}
