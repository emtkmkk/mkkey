/**
 * クライアントの実ソースを、通信・DOM・時計を差し替えて検査する補助。
 * @remarks 本番モジュールを書き換えず、TypeScriptとVueの既存コンパイラーを再利用する。
 * @internal
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const vue = require(path.join(root, 'packages/client/node_modules/vue'));
const compiler = require(path.join(root, 'packages/client/node_modules/@vue/compiler-sfc'));

function createLoader(mocks = {}, globals = {}) {
  const modules = new Map();
  function load(file, { append = '', source } = {}) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const code = ts.transpileModule((source ?? fs.readFileSync(path.join(root, file), 'utf8')) + append, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const context = vm.createContext({
      console, URL, URLSearchParams, Event, EventTarget, AbortController, Promise,
      setTimeout, clearTimeout, module, exports: module.exports, ...globals,
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === 'vue') return vue;
        if (name.startsWith('@/')) return load(`packages/client/src/${name.slice(2)}.ts`);
        throw new Error(`Unmocked import: ${name}`);
      },
    });
    vm.runInContext(code, context, { filename: file, timeout: 5000 });
    return module.exports;
  }
  return load;
}

function clock() {
  let now = 0;
  let sequence = 0;
  const timeouts = new Map();
  const intervals = new Map();
  class ClockDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  return {
    Date: ClockDate, performance: { now: () => now }, timeouts, intervals,
    setTimeout(fn, delay) { const id = ++sequence; timeouts.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn, delay) { const id = ++sequence; intervals.set(id, { fn, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timeouts]) {
        if (timer.at <= now && timeouts.has(id)) { timeouts.delete(id); timer.fn(); }
      }
    },
  };
}

class Image extends EventTarget {
  constructor() {
    super(); this.assignments = []; this.raw = ''; this.naturalWidth = 256;
    this.naturalHeight = 256; this.isConnected = true;
  }
  set src(value) { this.raw = value; this.assignments.push(value); }
  get src() { return new URL(this.raw, 'https://mkkey.test').href; }
  get currentSrc() { return this.src; }
  getAttribute(name) { return name === 'src' ? this.raw : null; }
  removeAttribute(name) { if (name === 'src') this.raw = ''; }
  compareDocumentPosition() { return 0; }
}

function emojiEnvironment() {
  const timers = clock();
  const module = createLoader({}, {
    ...timers, IntersectionObserver: undefined, Node: { DOCUMENT_POSITION_PRECEDING: 2 },
  })('packages/client/src/directives/emoji-src.ts', {
    append: '\nexports.audit = { loadQueue, activeLoads, states };',
  });
  return { directive: module.default, audit: module.audit, timers };
}

function renderer(createElement = () => ({}), patchProp = () => {}) {
  return vue.createRenderer({
    createElement, patchProp, insert() {}, remove() {}, setElementText() {},
    createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {},
    parentNode: () => null, nextSibling: () => null,
  });
}

function component(file, mocks, globals, inlineTemplate = false) {
  const descriptor = compiler.parse(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }).descriptor;
  const compiled = compiler.compileScript(descriptor, { id: 'idle-regression', reactivityTransform: true, inlineTemplate });
  const result = createLoader(mocks, globals)(file, { source: compiled.content }).default;
  if (!inlineTemplate) result.render = () => null;
  return result;
}

function proxyEnvironment(fetch) {
  const timers = clock();
  const module = createLoader({
    '@/config': { url: 'https://mkkey.test' },
    '@/instance': { instance: { mediaProxies: ['https://proxy.test', 'https://proxy2.test'] } },
  }, { ...timers, fetch })('packages/client/src/scripts/media-proxy-fallback.ts', {
    append: '\nexports.audit = { pendingImageChecks, queuedImageChecks, verifiedImageUrls };',
  });
  return { ...module, timers };
}

function proxyImage(name = 'same') {
  const image = new Image(); image.src = `/emoji/${name}@remote.test.webp`; return image;
}
function response(cacheControl = 'max-age=31536000, immutable') {
  return { body: { cancel: async () => {} }, headers: { get: () => cacheControl } };
}
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }

module.exports = { root, ts, vue, createLoader, clock, Image, emojiEnvironment, renderer, component, proxyEnvironment, proxyImage, response, flush };
