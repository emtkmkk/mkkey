/**
 * 既存の TypeScript コンパイラーを使い、通信とDBを差し替えて実ソースを検証する。
 * @remarks 本番設定・署名・データベースにはアクセスしない。
 * @internal
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function setup() {
  const actor = { id: 'cp-relay', uri: 'https://cp.mkkey.net/users/relay', host: 'cp.mkkey.net', inbox: 'https://cp.mkkey.net/users/relay/inbox', sharedInbox: 'https://cp.mkkey.net/inbox', isSuspended: false, isDeleted: false };
  const config = { url: 'https://mkkey.net', localRelayHosts: ['cp.mkkey.net'] };
  const rows = new Map();
  const deliveries = [];
  const subscribers = {
    async upsert(value) { rows.set(value.userId, value); },
    async delete(value) { if (rows.get(value.userId)?.followId === value.followId) rows.delete(value.userId); },
    async find() { return [...rows.values()].map(row => ({ ...row, user: actor })); },
  };
  const mocks = {
    '@/config/index.js': { __esModule: true, default: config },
    '@/models/index.js': { LocalRelaySubscribers: subscribers },
    '@/remote/activitypub/type.js': { getApId: value => typeof value === 'string' ? value : value.id },
    '@/remote/activitypub/renderer/index.js': { renderActivity: value => value },
    '@/queue/index.js': { deliver: async (...args) => deliveries.push(args) },
    './relay.js': { getRelayActor: async () => ({ id: 'mk-relay', host: null }) },
    '../logger.js': { apLogger: { warn() {} } },
    '@nestjs/common': { Injectable: () => value => value, Inject: () => () => {} },
    '@/di-symbols.js': { DI: { config: 'config', db: 'db' } },
    '@/models/LocalRelaySubscriber.js': { MiLocalRelaySubscriber: class {} },
    '@/core/RelayService.js': { RelayService: class {} },
    '@/core/QueueService.js': { QueueService: class {} },
    '@/core/activitypub/ApRendererService.js': { ApRendererService: class {} },
    '@/core/activitypub/type.js': { getApId: value => typeof value === 'string' ? value : value.id },
  };
  function load(file) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { URL, Map, Date, module, exports: module.exports, require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/')) return load(`packages/backend/src/${name.slice(2, -3)}.ts`);
      throw new Error(`Unmocked import ${name}`);
    } }, { filename: file });
    return module.exports;
  }
  const service = load('packages/backend/src/services/local-relay.ts');
  const follow = { type: 'Follow', id: 'https://cp.mkkey.net/activities/follow-relay/a', actor: actor.uri, object: 'https://www.w3.org/ns/activitystreams#Public' };
  const note = { userHost: null, visibility: 'public', localOnly: false, channelId: null };
  function fetchRoute(route, target, reader, relation = { isFollowing: false, isBlocked: false }) {
    const file = ts.createSourceFile('activitypub.ts', fs.readFileSync(path.join(root, 'packages/backend/src/server/activitypub.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
    const names = new Set(['getRemoteFetchAccess', 'authorizeNoteFetch']);
    const functions = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(file)).join('\n');
    const call = file.statements.filter(ts.isExpressionStatement).map(node => node.expression).find(node => ts.isCallExpression(node) && node.expression.getText(file) === 'router.get' && node.arguments[0]?.text === route);
    assert.ok(call, 'actual route must exist');
    const module = { exports: {} };
    const code = ts.transpileModule(functions + '\nexports.handler=' + call.arguments[1].getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, getRemoteVisibility: load('packages/backend/src/misc/semi-public.ts').getRemoteVisibility,
      isLocalRelayReader: service.isLocalRelayReader, getSignatureUser: async () => reader ? { user: reader } : null,
      Users: { getRelation: async () => relation }, Notes: { findOne: async () => target },
      serverLogger: { debug() {} }, In: value => value, IsNull: () => null,
      isActivityPubReq: () => true, checkFetch: async () => 200, renderActivity: value => value,
      renderNote: async () => ({ type: 'Note' }), packActivity: async () => ({ type: 'Create' }),
      fetchMeta: async () => ({ secureMode: false, privateMode: false }), setResponseType() {},
      getReferences: async () => ({}), isSelfHost: () => false,
    });
    return module.exports.handler;
  }
  return { actor, config, rows, deliveries, service, follow, note, load, fetchRoute };
}

test('許可した相手が購読した場合、元の Follow を含む Accept と投稿配送先を返す', async () => {
  const s = setup();
  assert.equal(await s.service.localRelayFollow(s.actor, s.follow), 'ok: local relay subscribed');
  assert.deepEqual(s.deliveries[0][1].object, s.follow);
  assert.equal(s.deliveries[0][2], s.actor.inbox);
  assert.equal((await s.service.getLocalRelayInboxes(s.note)).get(s.actor.sharedInbox), true);
});

test('ローカル公開・ホームの場合、リモートフォロワー設定がオンでもcpへ配送する', async () => {
  const s = setup(); await s.service.localRelayFollow(s.actor, s.follow);
  for (const visibility of ['public', 'home']) {
    for (const localOnly of [true, false]) assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, visibility, localOnly })).size, 1);
  }
});

test('限定・指定・hidden・チャンネル限定や受信したリモート投稿の場合、追加配送せずループしない', async () => {
  const s = setup(); await s.service.localRelayFollow(s.actor, s.follow);
  for (const visibility of ['followers', 'specified', 'hidden']) assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, visibility })).size, 0);
  assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, localOnly: true, channelId: 'channel' })).size, 0);
  assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, userHost: 'cp.mkkey.net' })).size, 0);
  s.config.localRelayHosts = [];
  assert.equal((await s.service.getLocalRelayInboxes(s.note)).size, 0);
});

test('通常フォローや未許可ホスト・偽装actor・別ホストへの配送の場合、購読を作らない', async () => {
  const s = setup();
  assert.equal(await s.service.localRelayFollow(s.actor, { ...s.follow, object: 'https://mkkey.net/users/normal' }), null);
  for (const change of [
    () => { s.follow.actor = 'https://evil.test/users/x'; },
    () => { s.follow.actor = s.actor.uri; s.follow.id = 'https://evil.test/follow'; },
    () => { s.follow.id = 'https://cp.mkkey.net/follow'; s.actor.sharedInbox = 'https://evil.test/inbox'; },
    () => { s.actor.sharedInbox = 'https://cp.mkkey.net/inbox'; s.config.localRelayHosts = []; },
    () => { s.config.localRelayHosts = 'cp.mkkey.net'; },
  ]) {
    change(); assert.match(await s.service.localRelayFollow(s.actor, s.follow), /^skip:/);
    assert.equal(s.rows.size, 0);
  }
});

test('購読を再登録した後に古いUndoが来た場合、新しい購読を維持する', async () => {
  const s = setup();
  await s.service.localRelayFollow(s.actor, s.follow);
  await s.service.localRelayFollow(s.actor, s.follow);
  assert.equal(s.rows.size, 1);
  const next = { ...s.follow, id: s.follow.id + 'next' };
  await s.service.localRelayFollow(s.actor, next);
  await s.service.localRelayFollow(s.actor, s.follow, true);
  assert.equal(s.rows.size, 1);
  await s.service.localRelayFollow(s.actor, next, true);
  assert.equal(s.rows.size, 0);
});

test('セミパブリックの純粋なリノートの場合、通常の公開宛先とcp用home情報を両立する', () => {
  const s = setup();
  const render = s.load('packages/backend/src/remote/activitypub/renderer/announce.ts').default;
  const note = { ...s.note, id: 'note', userId: 'author', mentionedRemoteUsers: '[]', createdAt: new Date(), visibility: 'home', semiPublic: true };
  const activity = render('https://mkkey.net/notes/original', note);
  assert.equal(activity.to[0], 'https://www.w3.org/ns/activitystreams#Public');
  assert.equal(activity._mk_localVisibility, 'home');
  const restricted = render('https://mkkey.net/notes/original', { ...note, localOnly: true, visibility: 'public' });
  assert.equal(restricted.to[0], 'https://mkkey.net/users/author/followers');
  assert.equal(restricted._mk_localVisibility, 'public');
  assert.equal(restricted.cc.length, 0);
});

test('購読済みcpが参照を取得する場合、公開・ホームだけを許可し、限定投稿や他ホストには広げない', async () => {
  const s = setup(); await s.service.localRelayFollow(s.actor, s.follow);
  const note = { ...s.note, localOnly: true };
  assert.equal(await s.service.isLocalRelayReader(note, { host: 'cp.mkkey.net' }), true);
  assert.equal(await s.service.isLocalRelayReader({ ...note, visibility: 'followers' }, s.actor), false);
  assert.equal(await s.service.isLocalRelayReader({ ...note, visibility: 'specified' }, s.actor), false);
  assert.equal(await s.service.isLocalRelayReader(note, { host: 'evil.test' }), false);
  await s.service.localRelayFollow(s.actor, s.follow, true);
  assert.equal(await s.service.isLocalRelayReader(note, s.actor), false);
});

test('制限付き投稿をリノートする場合、共有するローカル範囲以外には配送しない', async () => {
  const s = setup(); await s.service.localRelayFollow(s.actor, s.follow);
  const reference = { ...s.note, localOnly: true };
  assert.equal((await s.service.getLocalRelayReferenceInboxes(s.note, reference)).size, 1);
  for (const change of [{ userHost: 'evil.test' }, { visibility: 'followers' }, { visibility: 'specified' }, { channelId: 'channel' }]) {
    assert.equal((await s.service.getLocalRelayReferenceInboxes(s.note, { ...reference, ...change })).size, 0);
  }
});

test('実際のノート取得ルートの場合、署名済みの購読相手にだけ限定公開を返し共有キャッシュを禁止する', async () => {
  const s = setup(); await s.service.localRelayFollow(s.actor, s.follow);
  const note = { ...s.note, localOnly: true, userId: 'author' };
  function context() { return { req: {}, params: { note: 'note' }, request: { query: {} }, headers: {}, set(name, value) { this.headers[name] = value; } }; }
  for (const route of ['/notes/:note', '/notes/:note/activity', '/notes/:note/references']) {
    const ctx = context(); await s.fetchRoute(route, note, s.actor)(ctx);
    assert.ok(ctx.body); assert.match(ctx.headers['Cache-Control'], /^private/);
    const anonymous = context(); await s.fetchRoute(route, note, null)(anonymous);
    assert.equal(anonymous.status, 401); assert.equal(anonymous.body, undefined);
    const other = context(); await s.fetchRoute(route, note, { id: 'other', host: 'evil.test' })(other);
    assert.equal(other.status, 403); assert.equal(other.body, undefined);
    const blocked = context(); await s.fetchRoute(route, note, s.actor, { isFollowing: false, isBlocked: true })(blocked);
    assert.equal(blocked.status, 403);
  }
  const privateNote = context(); await s.fetchRoute('/notes/:note', { ...note, visibility: 'followers' }, s.actor)(privateNote);
  assert.equal(privateNote.status, 403);
  const channel = context(); await s.fetchRoute('/notes/:note', { ...note, channelId: 'private-channel' }, s.actor)(channel);
  assert.equal(channel.status, 404);
});

// 相手リポジトリもチェックアウトした開発環境では、双方の実装を組み合わせて追加検証する。
test('両側を実際のFollow(Public)で相互購読した場合、公開・ホームを双方向に届け、受信投稿を返送しない', { skip: !fs.existsSync(path.join(root, '../mkkey-cp/packages/backend/src/core/LocalRelayService.ts')) }, async () => {
  const s = setup();
  const { LocalRelayService } = s.load('../mkkey-cp/packages/backend/src/core/LocalRelayService.ts');
  const mkActor = { ...s.actor, id: 'mk-relay', uri: 'https://mkkey.net/users/relay', host: 'mkkey.net', inbox: 'https://mkkey.net/users/relay/inbox', sharedInbox: 'https://mkkey.net/inbox' };
  let cpSubscription;
  const cpAccepts = [];
  const cp = new LocalRelayService({ localRelayHosts: ['mkkey.net'] }, { getRepository: () => ({
    async upsert(value) { cpSubscription = value; },
    async find() { return cpSubscription ? [{ ...cpSubscription, user: mkActor }] : []; },
  }) }, { getRelayActor: async () => ({ id: 'cp-relay', host: null }) },
  { deliver: async (...args) => cpAccepts.push(args) }, { renderAccept: object => ({ type: 'Accept', object }), addContext: value => value });
  await s.service.localRelayFollow(s.actor, s.follow);
  const mkFollow = { ...s.follow, actor: mkActor.uri, id: 'https://mkkey.net/activities/follow-relay/a' };
  assert.equal(await cp.follow(mkActor, mkFollow), 'ok: local relay subscribed');
  assert.equal(cpAccepts[0][1].object, mkFollow);
  for (const visibility of ['public', 'home']) {
    assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, visibility })).has('https://cp.mkkey.net/inbox'), true);
    assert.equal((await cp.getInboxes({ ...s.note, visibility })).has('https://mkkey.net/inbox'), true);
  }
  assert.equal((await s.service.getLocalRelayInboxes({ ...s.note, userHost: 'cp.mkkey.net' })).size, 0);
  assert.equal((await cp.getInboxes({ ...s.note, userHost: 'mkkey.net' })).size, 0);
});
