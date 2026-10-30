import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: '15分ループタイマー',
    description: '作業タイマーと休憩タイマーを交互にくり返すポモドーロ風タイマー',
    permissions: ['alarms', 'notifications', 'offscreen', 'storage'],
  },
});
