/**
 * 画面破棄時の解除と、一覧の不要な監視を検査する。
 * @remarks 非表示中の購読停止など、表示の鮮度を変える挙動はこの修正に含めない。
 * @internal
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const h = require('./client-source-harness.cjs');
const compiler = require(path.join(h.root, 'packages/client/node_modules/@vue/compiler-sfc'));
const { vue } = h;

/** コンパイル後の実処理を取り出し、巨大な画面の無関係なAPIを起動せず検査する。 */
function compiledNodes(file) {
  const descriptor = compiler.parse(fs.readFileSync(path.join(h.root, file), 'utf8'), { filename: file }).descriptor;
  const source = compiler.compileScript(descriptor, { id: 'cleanup-test', reactivityTransform: true }).content;
  const tree = h.ts.createSourceFile(`${file}.ts`, source, h.ts.ScriptTarget.Latest, true);
  const nodes = [];
  function visit(node) { nodes.push(node); h.ts.forEachChild(node, visit); }
  visit(tree);
  return { tree, nodes };
}

function profileFrames() {
  const file = 'packages/client/src/pages/user/home.vue'; const { tree, nodes } = compiledNodes(file);
  const loop = nodes.find(node => h.ts.isFunctionDeclaration(node) && node.name?.text === 'parallaxLoop');
  const mounted = nodes.find(node => h.ts.isCallExpression(node) && node.expression.getText(tree) === 'onMounted' && node.getText(tree).includes('requestAnimationFrame'));
  const initial = mounted.arguments[0].body.statements.find(node => h.ts.isIfStatement(node) && node.getText(tree).includes('requestAnimationFrame'));
  const unmounted = nodes.find(node => h.ts.isCallExpression(node) && node.expression.getText(tree) === 'onUnmounted');
  const frames = new Map(); let sequence = 0; let drawn = 0;
  const animationId = vue.ref(null);
  const module = h.createLoader({}, {
    style: vue.ref({ backgroundImage: 'x' }), parallaxAnimationId: animationId, parallaxDisposed: false,
    onResize() {}, parallax: () => drawn++, window: {
      requestAnimationFrame(fn) { const id = sequence++; frames.set(id, fn); return id; },
      cancelAnimationFrame(id) { frames.delete(id); }, removeEventListener() {},
    },
  })(file, { source: `${loop.getText(tree)}\n${initial.getText(tree)}\nexports.cleanup = ${unmounted.arguments[0].getText(tree)};` });
  return { frames, animationId, cleanup: module.cleanup, drawn: () => drawn };
}

test('初回描画前にプロフィールを破棄する場合、IDが0でも予約を解除する', () => {
  const environment = profileFrames(); assert.equal(environment.frames.size, 1);
  const callback = [...environment.frames.values()][0];
  assert.equal(environment.animationId.value, 0);
  environment.cleanup(); assert.equal(environment.frames.size, 0);
  callback(); assert.equal(environment.frames.size, 0); assert.equal(environment.drawn(), 0);
});

test('プロフィールを表示し続ける場合は描画を継続し、破棄後は再予約しない', () => {
  const environment = profileFrames(); const [firstId, first] = [...environment.frames][0];
  environment.frames.delete(firstId); first();
  assert.equal(environment.drawn(), 1); assert.equal(environment.frames.size, 1);
  const late = [...environment.frames.values()][0]; environment.cleanup(); late();
  assert.equal(environment.frames.size, 0); assert.equal(environment.drawn(), 1);
});

function noteDetails() {
  const stream = new EventEmitter(); const handlers = new Set(); const requests = [];
  const Component = h.component('packages/client/src/components/MkNoteDetailed.vue', {
    '@/components/MkNote.vue': {}, '@/components/MkNoteSub.vue': {},
    '@/scripts/check-word-mute': { getWordSoftMute: () => ({ muted: false }) },
    '@/filters/user': {}, '@/filters/note': {},
    '@/store': { defaultStore: { state: { mutedWords: [], confirmShowImgCompress: true } }, noteViewInterruptors: [] },
    '@/account': { $i: null }, '@/i18n': { i18n: { ts: {} } },
    '@/scripts/use-note-capture': { useNoteCapture() {} },
    '@/scripts/clone': { deepClone: value => JSON.parse(JSON.stringify(value)) }, '@/stream': { stream },
    '@/os': { api: (endpoint, data) => endpoint === 'notes/show'
      ? new Promise(resolve => requests.push({ id: data.noteId, resolve })) : Promise.resolve([]) },
  }, { document: { addEventListener: (_name, fn) => handlers.add(fn), removeEventListener: (_name, fn) => handlers.delete(fn) } });
  const app = h.renderer().createApp(Component, { note: { id: 'root', fileIds: [], files: [], user: {}, text: 'root' } });
  app.mount({});
  return { app, state: app._instance.setupState, handlers, requests, stream };
}

test('投稿詳細を表示中の場合は返信を追加し、破棄時にwheel監視と購読を解除する', async () => {
  const environment = noteDetails(); await h.flush();
  environment.stream.emit('noteUpdated', { id: 'root', type: 'replied', body: { id: 'reply' } });
  environment.requests[0].resolve({ id: 'reply', replyId: 'root' }); await h.flush();
  assert.equal(environment.state.replies.length, 1); assert.equal(environment.state.directReplies.length, 1);
  assert.equal(environment.handlers.size, 1); for (const handler of environment.handlers) handler();
  assert.equal(environment.state.isScrolling, true);
  environment.app.unmount();
  assert.equal(environment.handlers.size, 0); assert.equal(environment.stream.listenerCount('noteUpdated'), 0);
});

test('返信取得待ちの間に投稿詳細を破棄する場合、返った返信を配列に追加しない', async () => {
  const environment = noteDetails(); await h.flush();
  environment.stream.emit('noteUpdated', { id: 'root', type: 'replied', body: { id: 'reply' } });
  assert.equal(environment.requests.length, 1); environment.app.unmount();
  environment.requests[0].resolve({ id: 'reply', replyId: 'root' }); await h.flush();
  assert.equal(environment.state.replies.length, 0); assert.equal(environment.state.directReplies.length, 0);
  assert.equal(environment.handlers.size, 0);
});

test('TL待機列の内部情報だけが変わる場合は通知せず、件数の増減は通知する', async () => {
  const file = 'packages/client/src/components/MkPagination.vue'; const { tree, nodes } = compiledNodes(file);
  const watchCall = nodes.find(node => h.ts.isCallExpression(node) && node.expression.getText(tree) === 'watch' && /queue/.test(node.arguments[0]?.getText(tree)));
  const queue = vue.ref([{ id: 'n1', emojis: [{ name: 'x', url: 'old' }] }]); const events = []; let stop;
  h.createLoader({}, {
    queue, emit: (...args) => events.push(args), isTop: () => true, isPausingUpdate: false,
    watch: (...args) => { stop = vue.watch(...args); },
  })(file, { source: watchCall.getText(tree) });
  queue.value[0].emojis[0].url = 'new'; await vue.nextTick(); assert.equal(events.length, 0);
  queue.value.push({ id: 'n2' }); await vue.nextTick();
  assert.deepEqual(events[0], ['queue', 2, true]);
  queue.value = [{ id: 'n3' }, { id: 'n4' }]; await vue.nextTick(); assert.equal(events.length, 1);
  queue.value = []; await vue.nextTick(); assert.deepEqual(events[1], ['queue', 0, true]); stop();
});

test('スクロール対象が差し替わる場合、前の監視を解除して最後の1件だけ保持する', async () => {
  const file = 'packages/client/src/components/MkPagination.vue'; const { tree, nodes } = compiledNodes(file);
  const watchCall = nodes.find(node => h.ts.isCallExpression(node) && node.expression.getText(tree) === 'watch' && /backed/.test(node.arguments[0]?.getText(tree)) && /contentEl/.test(node.arguments[0]?.getText(tree)));
  const backed = vue.ref(false);
  const contentEl = vue.ref(null);
  const scrollRemove = vue.ref(null);
  const active = new Set(); let created = 0; let removed = 0; let stop;
  function onScroll() {
    const id = ++created; active.add(id);
    return () => { removed++; active.delete(id); };
  }
  h.createLoader({}, {
    backed, contentEl, scrollRemove, props: { pagination: { reversed: false } }, unref: vue.unref,
    onScrollTop: onScroll, onScrollBottom: onScroll, executeQueue() {}, TOLERANCE: 1,
    watch: (...args) => { stop = vue.watch(...args); },
  })(file, { source: watchCall.getText(tree) });
  for (let i = 0; i < 5; i++) { contentEl.value = { id: i }; await vue.nextTick(); assert.equal(active.size, 1); }
  backed.value = true; await vue.nextTick(); assert.equal(active.size, 0);
  backed.value = false; await vue.nextTick(); assert.equal(active.size, 1);
  // 実コンポーネントのonBeforeUnmountと、その後のwatch終了を両方通しても一度だけ解除する。
  scrollRemove.value(); scrollRemove.value = null; stop();
  assert.equal(active.size, 0); assert.equal(created, removed);
});
