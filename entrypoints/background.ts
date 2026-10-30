import { browser } from '#imports';
import { isTimerMessage } from '@/utils/messages';
import { settingsItem, timerStateItem } from '@/utils/storage';
import { isRinging, transition, type TimerEvent, type TimerSettings, type TimerState } from '@/utils/timer';

const PHASE_END_ALARM = 'phase-end';
const RINGING_NOTIFICATION = 'ringing';

export default defineBackground(() => {
  // 通知のクリックと close が同時に来ることもあるので、イベントは直列に処理する
  let queue: Promise<void> = Promise.resolve();
  const dispatch = (event: TimerEvent): Promise<void> => {
    queue = queue.then(() => handle(event)).catch((error) => console.error(error));
    return queue;
  };

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isTimerMessage(message)) return;
    dispatch(message.event).then(() => sendResponse());
    return true;
  });

  // service worker は数十秒で停止するので、時間経過は setTimeout ではなく alarms で受け取る
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PHASE_END_ALARM) void dispatch('elapsed');
  });

  browser.notifications.onClicked.addListener((id) => {
    if (id === RINGING_NOTIFICATION) void dispatch('dismiss');
  });
  browser.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    if (id === RINGING_NOTIFICATION) void dispatch(buttonIndex === 0 ? 'dismiss' : 'stop');
  });
  browser.notifications.onClosed.addListener((id, byUser) => {
    if (id === RINGING_NOTIFICATION && byUser) void dispatch('dismiss');
  });

  // ブラウザ起動時・拡張の更新時は、前回のアラームや音が残らないように片付ける
  browser.runtime.onStartup.addListener(() => void dispatch('stop'));
  browser.runtime.onInstalled.addListener(() => void dispatch('stop'));
});

async function handle(event: TimerEvent): Promise<void> {
  const [state, settings] = await Promise.all([timerStateItem.getValue(), settingsItem.getValue()]);
  const next = transition(state, event, settings, Date.now());
  // stop は起動時の後片付けにも使うので、状態が変わらなくても副作用を適用する
  if (next === state && event !== 'stop') return;

  await timerStateItem.setValue(next);
  await applySideEffects(next, settings);
}

/** アラーム・音・通知・バッジを、状態に合わせた形にそろえる */
async function applySideEffects(state: TimerState, settings: TimerSettings): Promise<void> {
  await browser.alarms.clear(PHASE_END_ALARM);
  if (state.endsAt !== null) {
    await browser.alarms.create(PHASE_END_ALARM, { when: state.endsAt });
  }

  const tasks = isRinging(state.phase)
    ? [playSound(state.phase), showNotification(state.phase, settings), setBadge('!')]
    : [stopSound(), clearNotification(), setBadge('')];
  // 通知が出せない環境でも音は鳴らしたいので、1つの失敗で他を止めない
  for (const result of await Promise.allSettled(tasks)) {
    if (result.status === 'rejected') console.error(result.reason);
  }
}

/** service worker では音を鳴らせないので、offscreen document を開いて鳴らす(閉じれば止まる) */
async function playSound(phase: 'workEnded' | 'restEnded'): Promise<void> {
  await stopSound();
  await browser.offscreen.createDocument({
    url: `offscreen.html?phase=${phase}`,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'タイマー終了のアラーム音を鳴らすため',
  });
}

async function stopSound(): Promise<void> {
  const contexts = await browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) await browser.offscreen.closeDocument();
}

async function showNotification(phase: 'workEnded' | 'restEnded', settings: TimerSettings): Promise<void> {
  const content =
    phase === 'workEnded'
      ? { title: '作業時間が終わりました', message: `止めると ${settings.restSeconds}秒 の休憩タイマーが始まります` }
      : { title: '休憩時間が終わりました', message: `止めると ${settings.workMinutes}分 の作業タイマーが始まります` };

  await browser.notifications.create(RINGING_NOTIFICATION, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    ...content,
    buttons: [{ title: '止める' }, { title: 'ループを終了' }],
    requireInteraction: true,
    priority: 2,
    // 音は offscreen document で鳴らすので、OS の通知音は消しておく
    silent: true,
  });
}

async function clearNotification(): Promise<void> {
  await browser.notifications.clear(RINGING_NOTIFICATION);
}

async function setBadge(text: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color: '#d93025' });
  await browser.action.setBadgeText({ text });
}
