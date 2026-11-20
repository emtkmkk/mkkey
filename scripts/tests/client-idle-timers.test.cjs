/**
 * 入力欄のサイズ監視と共有時刻更新の回帰テスト。
 * @remarks 偽時計とResizeObserverで、復帰・破棄・表示間隔を検査する。実ブラウザー測定ではない。
 * @internal
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const h = require('./client-source-harness.cjs');
const { vue } = h;

function ticker() {
  const timers = h.clock(); const listeners = new Set();
  const document = {
    visibilityState: 'visible',
    addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn),
  };
  const globals = { ...timers, window: timers, document };
  const module = h.createLoader({}, globals)('packages/client/src/scripts/shared-time-ticker.ts');
  return { ...module, timers, document, globals, listeners, visible(value) {
    document.visibilityState = value ? 'visible' : 'hidden'; for (const listener of [...listeners]) listener();
  } };
}

test('複数の時刻表示を登録する場合、予約を1本にまとめて表示ごとの更新間隔を保つ', () => {
  const environment = ticker(); let fast = 0; let slow = 0;
  const stopFast = environment.registerTimeTick(() => { fast++; return 500; });
  const stopSlow = environment.registerTimeTick(() => { slow++; return 10000; });
  assert.equal(environment.timers.timeouts.size, 1); assert.equal(environment.listeners.size, 1);
  environment.timers.advance(500); assert.equal(fast, 2); assert.equal(slow, 1);
  environment.timers.advance(9500); assert.equal(fast, 3); assert.equal(slow, 2);
  stopFast(); stopFast(); assert.equal(environment.timers.timeouts.size, 1);
  stopSlow(); assert.equal(environment.timers.timeouts.size, 0); assert.equal(environment.listeners.size, 0);
});

test('タブを非表示から復帰する場合、未実行分を再生せず一度だけ現在時刻へ追従する', () => {
  const environment = ticker(); let calls = 0;
  const stop = environment.registerTimeTick(() => { calls++; return 10000; });
  environment.visible(false); assert.equal(environment.timers.timeouts.size, 0);
  environment.timers.advance(3600000); assert.equal(calls, 1);
  environment.visible(true); assert.equal(calls, 2); assert.equal(environment.timers.timeouts.size, 1);
  stop(); assert.equal(environment.listeners.size, 0);
});

test('非表示中に時刻表示を登録する場合、復帰するまで定期更新を始めない', () => {
  const environment = ticker(); environment.visible(false); let calls = 0;
  const stop = environment.registerTimeTick(() => { calls++; return 10000; });
  assert.equal(calls, 0); assert.equal(environment.timers.timeouts.size, 0);
  environment.visible(true); assert.equal(calls, 1); stop();
});

test('時刻表示が次の更新間隔を変更する場合、新しい期限で予約する', () => {
  const environment = ticker(); let calls = 0;
  const stop = environment.registerTimeTick(() => ++calls === 1 ? 500 : 30000);
  environment.timers.advance(500); assert.equal(calls, 2);
  environment.timers.advance(29999); assert.equal(calls, 2);
  environment.timers.advance(1); assert.equal(calls, 3); stop();
});

test('OSの時計が過去へ補正される場合も、定期更新の期限が遠のかない', () => {
  const environment = ticker(); let calls = 0;
  const stop = environment.registerTimeTick(() => { calls++; return 10000; });
  environment.timers.Date.now = () => -3600000;
  environment.timers.advance(10000); assert.equal(calls, 2);
  stop();
});

test('初回の時刻更新が失敗する場合、登録を残さず例外を伝える', () => {
  const environment = ticker();
  assert.throws(() => environment.registerTimeTick(() => { throw new Error('tick failed'); }), /tick failed/);
  assert.throws(() => environment.registerTimeTick(() => 0), /positive/);
  assert.equal(environment.timers.timeouts.size, 0); assert.equal(environment.listeners.size, 0);
});

test('定期更新の一つが失敗する場合、例外を隠さず他の時刻表示の更新を継続する', () => {
  const environment = ticker(); let badCalls = 0; let goodCalls = 0;
  const stopBad = environment.registerTimeTick(() => { if (++badCalls > 1) throw new Error('failed'); return 500; });
  const stopGood = environment.registerTimeTick(() => { goodCalls++; return 500; });
  assert.throws(() => environment.timers.advance(500), /failed/);
  assert.equal(environment.timers.timeouts.size, 1);
  environment.timers.advance(0); assert.equal(goodCalls, 2);
  stopBad(); stopGood(); assert.equal(environment.timers.timeouts.size, 0);
});

function timeComponent(environment) {
  return h.component('packages/client/src/components/global/MkTime.vue', {
    '@/i18n': { i18n: { ts: { countdownDone: 'done', _ago: {} }, t: () => '' } },
  }, environment.globals);
}

test('実際のMkTimeを10個表示する場合、定期予約は1本になり最後の破棄で解除される', () => {
  const environment = ticker(); const Component = timeComponent(environment);
  const apps = Array.from({ length: 10 }, () => { const app = h.renderer().createApp(Component, { time: new Date(0).toISOString(), mode: 'relative' }); app.mount({}); return app; });
  assert.equal(environment.timers.timeouts.size + environment.timers.intervals.size, 1); assert.equal(environment.listeners.size, 1);
  environment.timers.advance(10000);
  for (const app of apps) assert.equal(app._instance.setupState.now.getTime(), 10000);
  apps.forEach(app => app.unmount());
  assert.equal(environment.timers.timeouts.size, 0); assert.equal(environment.listeners.size, 0);
});

test('絶対時刻だけを表示する場合、更新タイマーと可視性監視を登録しない', () => {
  const environment = ticker(); const Component = timeComponent(environment);
  const app = h.renderer().createApp(Component, { time: new Date(0).toISOString(), mode: 'absolute' });
  app.mount({}); assert.equal(environment.timers.timeouts.size, 0); assert.equal(environment.listeners.size, 0); app.unmount();
});

test('MkTimeをキャッシュへ退避して復帰する場合、退避中は予約せず実時刻を反映する', async () => {
  const environment = ticker(); const Component = timeComponent(environment); const visible = vue.ref(true);
  const Other = { render: () => null };
  const app = h.renderer().createApp({ render: () => vue.h(vue.KeepAlive, { max: 4 }, {
    default: () => visible.value ? vue.h(Component, { time: new Date(0).toISOString() }) : vue.h(Other),
  }) });
  app.mount({}); await vue.nextTick();
  const state = app._instance.subTree.component.subTree.component.setupState;
  assert.equal(environment.timers.timeouts.size + environment.timers.intervals.size, 1);
  visible.value = false; await vue.nextTick(); assert.equal(environment.timers.timeouts.size + environment.timers.intervals.size, 0);
  environment.timers.advance(7200000); assert.equal(state.now.getTime(), 0);
  visible.value = true; await vue.nextTick();
  assert.equal(state.now.getTime(), 7200000); assert.equal(environment.timers.timeouts.size, 1);
  app.unmount(); assert.equal(environment.timers.timeouts.size, 0);
});

test('非表示中にカウントダウンの期限を過ぎる場合、復帰時に完了表示と通常間隔になる', () => {
  const environment = ticker(); const Component = timeComponent(environment);
  const app = h.renderer().createApp(Component, { time: new Date(10000).toISOString(), mode: 'detail', countdown: true });
  app.mount({}); const state = app._instance.setupState;
  assert.equal([...environment.timers.timeouts.values()][0]?.at ?? [...environment.timers.intervals.values()][0]?.delay, 500);
  environment.visible(false); assert.equal(environment.timers.timeouts.size + environment.timers.intervals.size, 0);
  environment.timers.advance(15000); environment.visible(true);
  assert.equal(state.countdownTime, 'done');
  assert.equal([...environment.timers.timeouts.values()][0].at, 25000);
  app.unmount();
});

function resizing() {
  const observers = [];
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.elements = new Set(); this.disconnected = false; observers.push(this); }
    observe(element, options) { this.elements.add(element); this.box = options.box; }
    disconnect() { this.disconnected = true; }
  }
  return { observers, ResizeObserver };
}

test('入力欄の装飾幅が変わる場合、必要な余白だけ更新し破棄後の通知は無視する', async () => {
  const environment = resizing(); const { useInputDecorations } = h.createLoader({}, environment)('packages/client/src/scripts/use-input-decorations.ts');
  const scope = vue.effectScope(); const input = vue.ref({ style: {} }); const prefix = vue.ref({ offsetWidth: 20 }); const suffix = vue.ref({ offsetWidth: 30 });
  scope.run(() => useInputDecorations(input, prefix, suffix)); await vue.nextTick();
  assert.equal(environment.observers.length, 1); assert.equal(environment.observers[0].box, 'border-box');
  assert.equal(input.value.style.paddingLeft, '20px'); assert.equal(input.value.style.paddingRight, '30px');
  prefix.value.offsetWidth = 0; environment.observers[0].callback(); assert.equal(input.value.style.paddingLeft, '20px');
  prefix.value.offsetWidth = 45; environment.observers[0].callback(); assert.equal(input.value.style.paddingLeft, '45px');
  prefix.value = { offsetWidth: 60 }; await vue.nextTick();
  assert.equal(environment.observers[0].disconnected, true); assert.equal(input.value.style.paddingLeft, '60px');
  scope.stop(); prefix.value.offsetWidth = 99; environment.observers[1].callback();
  assert.equal(input.value.style.paddingLeft, '60px'); assert.equal(environment.observers[1].disconnected, true);
});

test('入力欄の要素が後から表示される場合、要素確定後に装飾幅を設定する', async () => {
  const environment = resizing(); const { useInputDecorations } = h.createLoader({}, environment)('packages/client/src/scripts/use-input-decorations.ts');
  const scope = vue.effectScope(); const input = vue.ref(null); const prefix = vue.ref(null); const suffix = vue.ref(null);
  scope.run(() => useInputDecorations(input, prefix, suffix)); assert.equal(environment.observers.length, 0);
  input.value = { style: {} }; prefix.value = { offsetWidth: 25 }; await vue.nextTick();
  assert.equal(input.value.style.paddingLeft, '25px'); scope.stop();
});

for (const file of ['input', 'select']) {
  test(`${file}の入力値が変わる場合、周期タイマーを作らず従来の更新通知を出す`, async () => {
    const environment = resizing(); const timers = h.clock();
    const Component = h.component(`packages/client/src/components/form/${file}.vue`, {
      '@/components/MkButton.vue': {}, '@/os': {}, '@/i18n': { i18n: { ts: {} } },
      '@/scripts/autocomplete.js': { Autocomplete: class {} }, 'throttle-debounce': { debounce: (_delay, fn) => fn },
    }, { ...environment, ...timers, window: timers });
    const values = [];
    const app = h.renderer().createApp(Component, { modelValue: 'old', 'onUpdate:modelValue': value => values.push(value) }); app.mount({});
    const state = app._instance.setupState;
    state.inputEl = { style: {}, validity: { badInput: false } }; state.prefixEl = { offsetWidth: 20 }; state.suffixEl = { offsetWidth: 15 };
    await vue.nextTick(); state.v = 'new'; await vue.nextTick();
    assert.equal(state.inputEl.style.paddingLeft, '20px'); assert.equal(state.inputEl.style.paddingRight, '15px');
    assert.equal(values[0], 'new');
    assert.equal(timers.intervals.size, 0); app.unmount();
    assert.ok(environment.observers.every(observer => observer.disconnected));
  });
}
