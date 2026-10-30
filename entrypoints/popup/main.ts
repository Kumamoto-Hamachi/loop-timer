import './style.css';
import { sendTimerEvent } from '@/utils/messages';
import { settingsItem, timerStateItem } from '@/utils/storage';
import { DEFAULT_SETTINGS, IDLE_STATE, isRinging, type Phase, type TimerSettings, type TimerState } from '@/utils/timer';

const LABELS: Record<Phase, string> = {
  idle: '停止中',
  work: '作業中',
  workEnded: '作業時間終了',
  rest: '休憩中',
  restEnded: '休憩時間終了',
};

function hintFor(phase: Phase, { workMinutes, restSeconds }: TimerSettings): string {
  switch (phase) {
    case 'idle':
      return `${workMinutes}分作業 → ${restSeconds}秒休憩 をくり返します`;
    case 'work':
      return `終わると ${restSeconds}秒 の休憩に入ります`;
    case 'workEnded':
      return `止めると ${restSeconds}秒 の休憩が始まります`;
    case 'rest':
      return `終わると ${workMinutes}分 の作業に戻ります`;
    case 'restEnded':
      return `止めると ${workMinutes}分 の作業が始まります`;
  }
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const root = document.querySelector<HTMLElement>('.popup')!;
const phaseLabel = document.getElementById('phase-label')!;
const countdown = document.getElementById('countdown')!;
const hint = document.getElementById('hint')!;
const startButton = document.getElementById('start') as HTMLButtonElement;
const dismissButton = document.getElementById('dismiss') as HTMLButtonElement;
const stopButton = document.getElementById('stop') as HTMLButtonElement;
const workMinutesInput = document.getElementById('work-minutes') as HTMLInputElement;
const restSecondsInput = document.getElementById('rest-seconds') as HTMLInputElement;

let state: TimerState = IDLE_STATE;
let settings: TimerSettings = DEFAULT_SETTINGS;

function render(): void {
  root.dataset.phase = state.phase;
  phaseLabel.textContent = LABELS[state.phase];
  hint.textContent = hintFor(state.phase, settings);

  if (state.endsAt !== null) {
    countdown.textContent = formatRemaining(state.endsAt - Date.now());
  } else if (state.phase === 'idle') {
    countdown.textContent = formatRemaining(settings.workMinutes * 60_000);
  } else {
    countdown.textContent = '00:00';
  }

  startButton.hidden = state.phase !== 'idle';
  dismissButton.hidden = !isRinging(state.phase);
  dismissButton.textContent = state.phase === 'workEnded' ? '止めて休憩へ' : '止めて作業へ';
  stopButton.hidden = state.phase === 'idle';
}

function renderSettingsInputs(): void {
  // 入力中の値を上書きしないように、フォーカスしていない欄だけ更新する
  if (document.activeElement !== workMinutesInput) workMinutesInput.value = String(settings.workMinutes);
  if (document.activeElement !== restSecondsInput) restSecondsInput.value = String(settings.restSeconds);
}

function bindSettingInput(input: HTMLInputElement, key: keyof TimerSettings): void {
  input.addEventListener('change', async () => {
    const value = input.valueAsNumber;
    if (!input.checkValidity() || !Number.isInteger(value)) {
      input.value = String(settings[key]);
      return;
    }
    await settingsItem.setValue({ ...settings, [key]: value });
  });
}

startButton.addEventListener('click', () => sendTimerEvent('start'));
dismissButton.addEventListener('click', () => sendTimerEvent('dismiss'));
stopButton.addEventListener('click', () => sendTimerEvent('stop'));
bindSettingInput(workMinutesInput, 'workMinutes');
bindSettingInput(restSecondsInput, 'restSeconds');

timerStateItem.watch((value) => {
  state = value;
  render();
});
settingsItem.watch((value) => {
  settings = value;
  renderSettingsInputs();
  render();
});

[state, settings] = await Promise.all([timerStateItem.getValue(), settingsItem.getValue()]);
renderSettingsInputs();
render();
setInterval(render, 250);
