/**
 * 長時間稼働時の保持・重複通信・タイマーに対する回帰テスト。
 * @remarks ブラウザーと通信はモック。実ブラウザーの長時間負荷測定とは区別する。
 * @internal
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { root, ts, vue, createLoader, clock, Image, emojiEnvironment, renderer, component, proxyEnvironment, proxyImage, response, flush } = require('./client-source-harness.cjs');

test('同じ絵文字情報が繰り返し届く場合、配列を増やさず情報変更だけ反映する', () => {
  const stream = new EventEmitter(); stream.send = () => {}; const cleanups = [];
  const { useNoteCapture } = createLoader({
    vue: { ...vue, onUnmounted: fn => cleanups.push(fn) }, '@/stream': { stream },
    '@/account': { $i: { id: 'viewer' } }, '@/os': {},
  }, { document: { hidden: true, body: { contains: () => false } } })('packages/client/src/scripts/use-note-capture.ts');
  const note = vue.ref({ id: 'n1', emojis: [], reactions: {}, myReactions: [], myReactionsCnt: 0 });
  useNoteCapture({ rootEl: vue.ref({}), note, isDeletedRef: vue.ref(false) });
  function react(name, url = 'https://remote.test/a.webp') {
    stream.emit('noteUpdated', JSON.parse(JSON.stringify({ id: 'n1', type: 'reacted', body: {
      reaction: `:${name}:`, userId: 'other', emoji: { name, url },
    } })));
  }
  react('same@remote.test'); const original = note.value.emojis;
  for (let i = 0; i < 100; i++) react('same@remote.test');
  assert.equal(note.value.emojis, original);
  assert.equal(note.value.emojis.length, 1);
  assert.equal(note.value.reactions[':same@remote.test:'], 101);
  note.value.emojis[0].hiddenForViewer = true;
  react('same@remote.test', 'https://remote.test/b.webp');
  assert.equal(note.value.emojis[0].url, 'https://remote.test/b.webp');
  assert.equal(note.value.emojis[0].hiddenForViewer, true);
  react('same@other.test'); assert.equal(note.value.emojis.length, 2);
  cleanups.forEach(fn => fn());
  assert.equal(stream.listenerCount('noteUpdated'), 0);
  assert.equal(stream.listenerCount('_connected_'), 0);
});

test('読み込み済みのURLが同じ場合、プレースホルダーも画像も再設定しない', () => {
  const { directive, audit } = emojiEnvironment(); const image = new Image(); const value = '/emoji/a@remote.test.webp';
  directive.mounted(image, { value }); image.dispatchEvent(new Event('load'));
  for (let i = 0; i < 20; i++) directive.updated(image, { value });
  assert.equal(image.assignments.filter(src => src === value).length, 1);
  assert.equal(image.assignments.filter(src => src.includes('loading.png')).length, 1);
  assert.equal(audit.activeLoads.size, 0); directive.unmounted(image);
});

test('実際のMkEmojiが再描画される場合、同じ画像のsrcを設定し直さない', async () => {
  const { directive } = emojiEnvironment(); let image;
  const Component = component('packages/client/src/components/global/MkEmoji.vue', {
    '@/scripts/get-static-image-url': { getStaticImageUrl: src => src },
    '@/scripts/media-proxy-fallback': { getEmojiFallbackUrls: () => [], isProxyErrorImage: async () => false },
    '@/scripts/twemoji-base': { char2filePath: () => '' },
    '@/store': { defaultStore: { state: { reactionMutedWords: [], allEmojiReplace: [] } } },
    '@/instance': { instance: { emojis: [] }, emojiMap: vue.computed(() => new Map()) },
    '@/scripts/reaction-menu': {}, '@/os': {}, '@/config': { host: 'mkkey.test' },
    seedrandom: { default: () => () => 0 }, '@/scripts/sound.js': {},
  }, {}, true);
  const host = renderer(() => { image = new Image(); return image; }, (element, key, _old, value) => {
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
  });
  const note = vue.ref({ emojis: [{ name: 'same@remote.test', url: 'https://remote.test/files/same.webp' }] });
  const app = host.createApp({ render: () => vue.h(Component, { emoji: ':same@remote.test:', customEmojis: note.value.emojis, note: note.value }) });
  app.directive('emoji-src', directive); app.directive('tooltip', {}); app.mount({});
  image.dispatchEvent(new Event('load')); await vue.nextTick();
  for (let i = 0; i < 10; i++) {
    note.value.emojis = [...note.value.emojis]; await vue.nextTick();
  }
  assert.equal(image.assignments.filter(src => src === 'https://remote.test/files/same.webp').length, 1);
  assert.equal(image.assignments.filter(src => src.includes('loading.png')).length, 1);
  app.unmount();
});

test('カスタム絵文字が直接URLの場合、同時読み込みは3件以下になる', () => {
  const { directive, audit } = emojiEnvironment(); const images = Array.from({ length: 12 }, () => new Image());
  images.forEach((image, i) => directive.mounted(image, { value: `https://remote.test/files/${i}.webp`, arg: 'custom' }));
  assert.equal(audit.activeLoads.size, 3); assert.equal(audit.loadQueue.length, 9);
  assert.equal(images.filter(image => image.raw.includes('/files/')).length, 3);
  images.forEach(image => directive.unmounted(image));
  assert.equal(audit.loadQueue.length, 0); assert.equal(audit.activeLoads.size, 0);
});

test('通常のUnicode絵文字画像の場合、カスタム絵文字の待機枠を使わない', () => {
  const { directive, audit } = emojiEnvironment(); const image = new Image();
  const value = '/client-assets/twemoji/1f600.svg';
  directive.mounted(image, { value }); directive.updated(image, { value });
  assert.equal(image.raw, value); assert.equal(image.assignments.length, 1);
  assert.equal(audit.activeLoads.size, 0); directive.unmounted(image);
});

test('待機画像を破棄する場合、実行中通信の完了前でもDOM参照を取り除く', () => {
  const { directive, audit, timers } = emojiEnvironment(); const images = Array.from({ length: 30 }, () => new Image());
  images.forEach((image, i) => directive.mounted(image, { value: `/emoji/${i}@remote.test.webp` }));
  images.slice(3).forEach(image => directive.unmounted(image));
  assert.equal(audit.loadQueue.length, 0); assert.equal(audit.activeLoads.size, 3);
  const sources = images.slice(0, 3).map(image => image.raw);
  images.slice(0, 3).forEach(image => directive.unmounted(image));
  assert.deepEqual(images.slice(0, 3).map(image => image.raw), sources);
  assert.equal(timers.timeouts.size, 0);
});

test('読み込み中にURL変更・解除する場合、最新のURLだけを読み込む', () => {
  const { directive, audit } = emojiEnvironment(); const image = new Image();
  directive.mounted(image, { value: '/emoji/a.webp' });
  directive.updated(image, { value: '/emoji/b.webp' });
  directive.updated(image, { value: '/emoji/c.webp' });
  image.dispatchEvent(new Event('load'));
  assert.equal(image.raw, '/emoji/c.webp');
  assert.equal(image.assignments.includes('/emoji/b.webp'), false);
  image.dispatchEvent(new Event('error'));
  directive.updated(image, { value: '/emoji/fallback.webp' });
  assert.equal(image.raw, '/emoji/fallback.webp');
  directive.updated(image, { value: '' });
  assert.equal(image.raw, ''); assert.equal(audit.activeLoads.size, 0);
  directive.unmounted(image);
});

test('画像が応答しない場合、期限後に枠を解放してerrorを一度だけ通知する', () => {
  const { directive, audit, timers } = emojiEnvironment(); const image = new Image(); let errors = 0;
  image.addEventListener('error', () => errors++);
  directive.mounted(image, { value: '/emoji/timeout.webp' });
  timers.advance(10000); assert.equal(errors, 1); assert.equal(audit.activeLoads.size, 0);
  timers.advance(10000); assert.equal(errors, 1); directive.unmounted(image);
});

test('同じURLのプロキシ確認が重なる場合、通信を1件に共有する', async () => {
  let requests = 0; let complete;
  const environment = proxyEnvironment(() => { requests++; return new Promise(resolve => { complete = resolve; }); });
  const pending = Array.from({ length: 20 }, () => environment.isProxyErrorImage(proxyImage()));
  assert.equal(requests, 1); complete(response());
  assert.deepEqual(await Promise.all(pending), Array(20).fill(false));
  assert.equal(environment.audit.pendingImageChecks.size, 0);
  await environment.isProxyErrorImage(proxyImage()); assert.equal(requests, 1);
  assert.equal(environment.timers.timeouts.size, 0);
});

test('複数URLの確認が待機する場合、3件ずつ実行し失敗でも次へ進む', async () => {
  const requests = [];
  const environment = proxyEnvironment(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
  const pending = Array.from({ length: 5 }, (_, i) => environment.isProxyErrorImage(proxyImage(String(i))));
  assert.equal(requests.length, 3);
  requests[0].reject(new Error('offline')); await flush(); assert.equal(requests.length, 4);
  requests[1].resolve(response('max-age=300')); await flush(); assert.equal(requests.length, 5);
  requests[2].resolve(response(null)); requests[3].resolve(response()); requests[4].resolve(response());
  assert.deepEqual(await Promise.all(pending), [false, true, false, false, false]);
  assert.equal(environment.audit.pendingImageChecks.size, 0);
});

test('確認の上限・期限を超える場合、保留を解消し復帰後に古い要求を発行しない', async () => {
  let requests = 0; let aborted = 0;
  const environment = proxyEnvironment((_src, options) => {
    requests++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborted++; reject(new Error('aborted')); }, { once: true }));
  });
  const pending = Array.from({ length: 128 }, (_, i) => environment.isProxyErrorImage(proxyImage(String(i))));
  assert.equal(requests, 3); assert.equal(await environment.isProxyErrorImage(proxyImage('overflow')), false);
  environment.timers.advance(10000);
  assert.deepEqual(await Promise.all(pending), Array(128).fill(false));
  assert.equal(requests, 3); assert.equal(aborted, 3);
  assert.equal(environment.audit.pendingImageChecks.size, 0); assert.equal(environment.audit.queuedImageChecks.length, 0);
  assert.equal(environment.timers.timeouts.size, 0);
});

test('256四方でない画像の場合、追加の確認通信を行わない', async () => {
  let requests = 0; const environment = proxyEnvironment(async () => { requests++; return response(); });
  const image = proxyImage(); image.naturalWidth = 32;
  assert.equal(await environment.isProxyErrorImage(image), false); assert.equal(requests, 0);
});

test('期限後に古い確認結果が返る場合、同じURLの新しい要求やキャッシュに影響しない', async () => {
  const requests = [];
  const environment = proxyEnvironment(() => new Promise(resolve => requests.push(resolve)));
  const stale = environment.isProxyErrorImage(proxyImage());
  environment.timers.advance(10000); assert.equal(await stale, false);
  const fresh = environment.isProxyErrorImage(proxyImage());
  requests[0](response()); await flush();
  assert.equal(environment.audit.pendingImageChecks.size, 1);
  assert.equal(environment.audit.verifiedImageUrls.size, 0);
  requests[1](response('no-store')); assert.equal(await fresh, true);
  assert.equal(environment.audit.pendingImageChecks.size, 0);
});

test('成功画像の確認が上限を超える場合、古いURLを追い出す', async () => {
  let requests = 0; const environment = proxyEnvironment(async () => { requests++; return response(); });
  for (let i = 0; i < 513; i++) await environment.isProxyErrorImage(proxyImage(String(i)));
  assert.equal(environment.audit.verifiedImageUrls.size, 512);
  await environment.isProxyErrorImage(proxyImage('512')); assert.equal(requests, 513);
  await environment.isProxyErrorImage(proxyImage('0')); assert.equal(requests, 514);
});

test('アバター一覧を更新・間隔変更・破棄する場合、タイマーは1件から0件になる', async () => {
  const timers = clock(); const warnings = [];
  const Component = component('packages/client/src/components/MkAvatars.vue', { '@/os': { api: async () => [] } }, { ...timers, window: timers });
  const ids = vue.ref(['initial']); const interval = vue.ref(60000);
  const app = renderer().createApp({ render: () => vue.h(Component, { userIds: ids.value, interval: interval.value }) });
  app.config.warnHandler = message => warnings.push(message); app.mount({}); await vue.nextTick(); await flush();
  for (let i = 0; i < 5; i++) { ids.value = [`u${i}`]; await vue.nextTick(); await flush(); }
  assert.equal(timers.intervals.size, 1);
  interval.value = 300000; await vue.nextTick();
  assert.equal(timers.intervals.size, 1); assert.equal([...timers.intervals.values()][0].delay, 300000);
  app.unmount(); assert.equal(timers.intervals.size, 0); assert.deepEqual(warnings, []);
});

test('カテゴリボタンを繰り返し破棄する場合、resize監視が残らない', () => {
  const listeners = new Set(); const state = { followCategories: [] };
  const Component = component('packages/client/src/components/MkCategoryFollowButton.vue', {
    '@/i18n': { i18n: { ts: {} } }, '@/instance': { fetchCustomCategory() {} },
    '@/store': { defaultStore: { makeGetterSetter: key => ({ get: () => state[key], set: value => { state[key] = value; } }) } },
  }, { window: { innerWidth: 1000, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) } });
  for (let i = 0; i < 20; i++) { const app = renderer().createApp(Component, { categoryId: `c${i}` }); app.mount({}); app.unmount(); }
  assert.equal(listeners.size, 0);
});

test('カテゴリボタンの画面幅が変わる場合、ラベル状態を更新して読み取り専用への代入警告を出さない', async () => {
  const listeners = new Set(); const warnings = []; const state = { followCategories: [] };
  const browser = { innerWidth: 1000, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) };
  const Component = component('packages/client/src/components/MkCategoryFollowButton.vue', {
    '@/i18n': { i18n: { ts: {} } }, '@/instance': { fetchCustomCategory() {} },
    '@/store': { defaultStore: { makeGetterSetter: key => ({ get: () => state[key], set: value => { state[key] = value; } }) } },
  }, { window: browser });
  const app = renderer().createApp(Component, { categoryId: 'c' }); app.config.warnHandler = message => warnings.push(message);
  app.mount({}); const instance = app._instance;
  assert.equal(instance.setupState.full, false);
  browser.innerWidth = 700; for (const listener of listeners) listener(); await vue.nextTick();
  assert.equal(instance.setupState.full, true);
  browser.innerWidth = 1200; for (const listener of listeners) listener(); await vue.nextTick();
  assert.equal(instance.setupState.full, false); assert.deepEqual(warnings, []);
  app.unmount(); assert.equal(listeners.size, 0);
});

test('アバター取得中に破棄する場合、遅れた結果を反映せずタイマーも残さない', async () => {
  const timers = clock(); let complete;
  const Component = component('packages/client/src/components/MkAvatars.vue', {
    '@/os': { api: () => new Promise(resolve => { complete = resolve; }) },
  }, { ...timers, window: timers });
  const app = renderer().createApp(Component, { userIds: ['a'] }); app.mount({});
  const instance = app._instance; app.unmount(); complete([{ id: 'a' }]); await flush();
  assert.equal(instance.setupState.users.length, 0); assert.equal(timers.intervals.size, 0);
});

test('上限付きキャッシュが満杯の場合、最近読んだ項目を残し最古を除く', () => {
  const { LimitedCache } = createLoader()('packages/client/src/scripts/limited-cache.ts');
  assert.throws(() => new LimitedCache(0), /positive integer/);
  assert.throws(() => new LimitedCache(1.5), /positive integer/);
  const cache = new LimitedCache(2); cache.set('a', 1); cache.set('b', 2);
  assert.equal(cache.get('a'), 1); cache.set('c', 3);
  assert.equal(cache.get('b'), undefined); assert.equal(cache.size, 2);
  cache.set('a', 4); assert.equal(cache.size, 2); assert.equal(cache.get('a'), 4);
  cache.clear(); assert.equal(cache.size, 0);
});

test('参照キャッシュを上限まで使う場合、共有取得・追い出し・クリア後の寿命を保つ', async () => {
  const requests = [];
  const module = createLoader({ '@/os': { api: (_endpoint, data) => new Promise(resolve => requests.push({ id: data.noteId, resolve })) } })(
    'packages/client/src/composables/use-remote-references.ts', { append: '\nexports.audit = { sessionCache };' },
  );
  const first = module.fetchRemoteReferences('same'); const second = module.fetchRemoteReferences('same');
  assert.equal(requests.length, 1); requests[0].resolve([]); await Promise.all([first, second]);
  for (let i = 0; i < 100; i++) { const pending = module.fetchRemoteReferences(String(i)); requests.at(-1).resolve([]); await pending; }
  assert.equal(module.audit.sessionCache.size, 100);
  const reread = module.fetchRemoteReferences('same'); assert.equal(requests.length, 102); requests.at(-1).resolve([]); await reread;
  const stale = module.fetchRemoteReferences('pending'); const old = requests.at(-1);
  module.clearRemoteReferencesSessionCache(); const fresh = module.fetchRemoteReferences('pending'); const latest = requests.at(-1);
  old.resolve(['old']); await stale; latest.resolve(['new']); await fresh;
  assert.equal((await module.fetchRemoteReferences('pending'))[0], 'new');
});

test('プラグインがログを出し続ける場合、最新の200件だけ残る', () => {
  const file = 'packages/client/src/plugin.ts'; const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  // 依存の多いプラグイン実行環境を起動せず、実ソースのログ保持処理だけを検査する。
  const selected = tree.statements.filter(statement =>
    (ts.isFunctionDeclaration(statement) && statement.name?.text === 'appendLog') ||
    (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ['MAX_PLUGIN_LOG_ENTRIES', 'pluginLogs'].includes(declaration.name.getText(tree)))),
  ).map(statement => statement.getText(tree)).join('\n');
  const { appendLog, pluginLogs } = createLoader({}, { ref: vue.ref })(file, { source: selected, append: '\nexports.appendLog = appendLog;' });
  for (let i = 0; i < 1000; i++) appendLog('plugin', String(i));
  const logs = pluginLogs.value.get('plugin'); assert.equal(logs.length, 200);
  assert.equal(logs[0].message, '800'); assert.equal(logs.at(-1).message, '999');
});
