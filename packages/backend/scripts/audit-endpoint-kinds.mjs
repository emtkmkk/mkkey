/**
 * @packageDocumentation
 *
 * API エンドポイントの `meta.kind` 設定漏れを検出する静的監査スクリプト。
 *
 * @remarks
 * CVE-2023-52139 対策後、`requireCredential: true` かつ `secure: false` のエンドポイントには
 * アプリトークン向けの `meta.kind` が必要。本スクリプトはその漏れを CI / 手動確認用に列挙する。
 *
 * 意図的に `kind` 不要とする例外:
 * - `secure: true`（セッショントークン専用。2FA・パスワード・トークン管理など）
 * - `sw/*`（ブラウザ Push 登録。本家 Misskey も `kind` なし）
 *
 * @remarks
 * 以前は `requireModerator` / `requireAdmin` と `admin/*` を一律で除外していたが、
 * それだと管理系エンドポイントが恒久的にアプリトークンから使えないままになり、
 * 実際に絵文字インポート申請の承認が動かなくなっていた。本家 Misskey と同様、
 * 管理系にも `read:admin:*` / `write:admin:*` を振る方針に変更している。
 * `requireModerator` / `requireAdmin` のチェックは `kind` とは独立に効くため、
 * これらのスコープを持つトークンでも非モデレータが管理操作を行うことはできない。
 *
 * @internal
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const endpointsRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	"../src/server/api/endpoints",
);

/** @param {string} dir */
function walkTsFiles(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkTsFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			files.push(full);
		}
	}
	return files;
}

/**
 * `export const meta` ブロックからフラグを抽出する。
 *
 * @param {string} content
 */
function parseMetaFlags(content) {
	const metaMatch = content.match(/export const meta\s*=\s*\{([\s\S]*?)\}\s*as const/);
	if (metaMatch == null) {
		return null;
	}
	const block = metaMatch[1];
	const has = (pattern) => pattern.test(block);
	return {
		requireCredential: has(/requireCredential:\s*true/),
		requireModerator: has(/requireModerator:\s*true/),
		requireAdmin: has(/requireAdmin:\s*true/),
		secure: has(/secure:\s*true/),
		// meta 直下の OAuth スコープだけを見る。`errors` の中にも `kind` を持つ
		// 定義があるため、より深い階層のものを拾わない。
		// インデントがタブのファイルとスペースのファイルが混在しているので、
		// 幅を決め打ちせずブロック内の最小インデントを「直下」とみなす。
		kind: topLevelKind(block),
	};
}

/**
 * meta ブロック直下の `kind` の値を返す。無ければ null。
 *
 * @param {string} block
 */
function topLevelKind(block) {
	const lines = block.split("\n").filter((l) => l.trim() !== "");
	if (lines.length === 0) return null;
	const indentOf = (l) => (l.match(/^[ \t]*/) ?? [""])[0].length;
	const top = Math.min(...lines.map(indentOf));
	for (const line of lines) {
		if (indentOf(line) !== top) continue;
		const m = line.match(/^[ \t]*kind:\s*["']([^"']+)["']/);
		if (m) return m[1];
	}
	return null;
}

/**
 * `kind` を持たないことを意図的に許可するエンドポイント。
 *
 * @param {string} relPath
 */
function isAllowlistedWithoutKind(relPath) {
	// ブラウザ Push 購読の登録。本家 Misskey も kind を振っていない。
	if (relPath.startsWith("sw/")) return true;
	return false;
}

/** `api-permissions.ts` に定義済みのスコープ一覧。 */
const knownKinds = new Set(
	[
		...readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), "../src/misc/api-permissions.ts"),
			"utf8",
		).matchAll(/^\t"([^"]+)",$/gm),
	].map((m) => m[1]),
);

/** @type {string[]} */
const violations = [];
/** 権限一覧に存在しない kind を指しているエンドポイント。付与不能なので必ず 403 になる。 */
const unknownKinds = [];

for (const file of walkTsFiles(endpointsRoot)) {
	const relPath = relative(endpointsRoot, file).replace(/\\/g, "/").replace(/\.ts$/, "");
	const content = readFileSync(file, "utf8");
	const meta = parseMetaFlags(content);
	if (meta == null) continue;

	// kind を持つなら、それが実在するスコープかどうかは常に検査する。
	// 一覧に無いスコープはトークンに付与できないため、必ず PERMISSION_DENIED になる。
	if (meta.kind && !knownKinds.has(meta.kind)) {
		unknownKinds.push(`${relPath} → ${meta.kind}`);
	}

	if (!meta.requireCredential && !meta.requireModerator && !meta.requireAdmin) continue;
	if (meta.secure) continue;
	if (isAllowlistedWithoutKind(relPath)) continue;
	if (meta.kind) continue;

	violations.push(relPath);
}

let failed = false;

if (violations.length > 0) {
	failed = true;
	console.error("meta.kind が未設定のエンドポイント:");
	for (const path of violations.sort()) {
		console.error(`  - ${path}`);
	}
}

if (unknownKinds.length > 0) {
	failed = true;
	console.error("api-permissions.ts に存在しない kind を指しているエンドポイント:");
	for (const path of unknownKinds.sort()) {
		console.error(`  - ${path}`);
	}
}

if (failed) process.exit(1);

console.log(
	"audit-endpoint-kinds: OK（対象エンドポイントはすべて meta.kind が設定済み、かつ全 kind が api-permissions.ts に存在）",
);
