/**
 * moderationNote に書かれている自作絵文字ボーナスの回数（例「3/5」）を読み取り、
 * `user.emojiDriveGrantCount` に取り込む一度きりのスクリプト。
 *
 * 既定は dry-run。何をどう読み取ったかを全部表示するので、目視で確認してから --apply する。
 * ドライブ容量には触らない（過去分は既に加算済みのはずなので）。
 *
 *   pnpm --filter backend build   # built/config を使うので先にビルドしておく
 *   node scripts/backfill-emoji-grant-count.mjs
 *   node scripts/backfill-emoji-grant-count.mjs --apply
 *
 * 表記ゆれで拾えない場合は --pattern で正規表現を差し替える。
 *   node scripts/backfill-emoji-grant-count.mjs --pattern '(\d+)\s*回\s*[/／]\s*5'
 */
import pg from "pg";
import config from "../built/config/index.js";

const MAX_GRANTS = 5;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const patternArg = argv.includes("--pattern") ? argv[argv.indexOf("--pattern") + 1] : null;

/**
 * 既定は「数字 / 5」。全角スラッシュと前後の空白を許容する。
 *
 * 数字を1桁に絞らないのは意図的。絞ると「2024/5/1」から「4/5」を拾って
 * 4回と誤認してしまうが、絞らなければ 2024 という明らかにおかしい値になり、
 * 下の上限チェックで確実に止まる。
 */
const pattern = new RegExp(patternArg ?? String.raw`(\d+)\s*[/／]\s*5`);
const globalPattern = new RegExp(pattern.source, "g");

const client = new pg.Client({
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.pass,
	database: config.db.db,
});
await client.connect();

const { rows } = await client.query(`
	SELECT u."id", u."username", u."emojiDriveGrantCount", p."moderationNote"
	FROM "user" u
	JOIN "user_profile" p ON p."userId" = u."id"
	WHERE u."host" IS NULL
	  AND p."moderationNote" IS NOT NULL
	  AND p."moderationNote" <> ''
	ORDER BY u."username"
`);

const oneLine = (s, n) => s.replace(/\s+/g, " ").slice(0, n);

function excerptAround(text, index, span = 40) {
	const from = Math.max(0, index - span);
	const to = Math.min(text.length, index + span);
	return (
		(from > 0 ? "…" : "") +
		text.slice(from, to).replace(/\s+/g, " ") +
		(to < text.length ? "…" : "")
	);
}

const matched = [];
const ambiguous = [];
const suspicious = [];

for (const r of rows) {
	const note = r.moderationNote;
	const hits = [...note.matchAll(globalPattern)];

	// 1ノートに複数ヒットしたら、黙って先頭を採らずに人間に回す。
	if (hits.length > 1) {
		ambiguous.push({ ...r, hits: hits.map((h) => h[0]), excerpt: oneLine(note, 160) });
		continue;
	}

	if (hits.length === 1) {
		const m = hits[0];
		const count = Number(m[1]);
		matched.push({
			...r,
			count,
			matchedText: m[0],
			overMax: count > MAX_GRANTS,
			excerpt: excerptAround(note, m.index),
		});
		continue;
	}

	// パターンには当たらないが「5」や「絵文字」を含むノート。取りこぼしの候補。
	if (/5/.test(note) || note.includes("絵文字")) {
		suspicious.push({ ...r, excerpt: oneLine(note, 120) });
	}
}

console.log(`■ パターン: ${pattern}`);
console.log(`  moderationNote があるローカルユーザー: ${rows.length}人`);
console.log(
	`  読み取れた: ${matched.length}人 / 複数ヒット: ${ambiguous.length}人 / 取りこぼし候補: ${suspicious.length}人\n`,
);

console.log("■ 読み取れたもの");
for (const m of matched) {
	const flag = m.overMax ? `  ⚠ 上限${MAX_GRANTS}を超えています` : "";
	const now = m.emojiDriveGrantCount !== 0 ? `  (現在値 ${m.emojiDriveGrantCount})` : "";
	console.log(`  @${m.username}\t${m.count}回\t「${m.matchedText}」${now}${flag}`);
	console.log(`      ${m.excerpt}`);
}

if (ambiguous.length) {
	console.log(`\n■ 複数ヒット（自動では決めない）`);
	console.log(`  1つのノートにパターンが複数当たりました。日付などの誤マッチの可能性があります。`);
	for (const a of ambiguous) {
		console.log(`  @${a.username}\t候補: ${a.hits.join(" , ")}`);
		console.log(`      ${a.excerpt}`);
	}
}

if (suspicious.length) {
	console.log(`\n■ 取りこぼし候補（パターンに当たらないが 5 か「絵文字」を含むノート）`);
	console.log(`  ここに拾うべきものが混じっていたら --pattern を調整してください。`);
	for (const s of suspicious) {
		console.log(`  @${s.username}\t${s.excerpt}`);
	}
}

const overMax = matched.filter((m) => m.overMax);
if (overMax.length) {
	console.log(
		`\n⚠ 上限 ${MAX_GRANTS} を超える値が ${overMax.length}人分あります: ` +
			overMax.map((m) => `@${m.username}(${m.count})`).join(", "),
	);
	console.log(`  読み取り間違いの可能性が高いので、--apply の前に確認してください。`);
}

if (!apply) {
	console.log(`\n（dry-run。書き込むには --apply）`);
	if (ambiguous.length) {
		console.log(
			`  複数ヒットの ${ambiguous.length}人は --apply しても書き込まれません。` +
				`\n  --pattern を調整するか、admin/set-emoji-grant-count で手で入れてください。`,
		);
	}
	await client.end();
	process.exit(overMax.length + ambiguous.length ? 1 : 0);
}

if (overMax.length) {
	console.error(`\n❌ 上限超えがあるため中断しました。--pattern を調整するか、該当分を手で直してください。`);
	await client.end();
	process.exit(1);
}

let updated = 0;
for (const m of matched) {
	await client.query(`UPDATE "user" SET "emojiDriveGrantCount" = $1 WHERE "id" = $2`, [
		m.count,
		m.id,
	]);
	updated++;
}

console.log(`\n✓ ${updated}人分を書き込みました。`);
if (ambiguous.length) {
	console.log(
		`  複数ヒットの ${ambiguous.length}人は書き込んでいません: ` +
			ambiguous.map((a) => `@${a.username}`).join(", "),
	);
}
console.log(`  パック済みユーザーのキャッシュが残っているので、反映には再起動が必要です。`);

await client.end();
