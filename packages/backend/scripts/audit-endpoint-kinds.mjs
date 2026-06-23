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
 * - `admin/*`（モデレータ/管理者専用）
 * - `requireModerator` / `requireAdmin`
 * - `secure: true`（セッショントークン専用）
 * - `sw/*`（ブラウザ Push 登録。本家 Misskey も `kind` なし）
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
		// paramDef / errors 内の kind ではなく meta 直下の OAuth スコープ
		kind: /^\s*kind:\s*["']([^"']+)["']/m.test(block),
	};
}

/** @param {string} relPath */
function isAllowlistedWithoutKind(relPath) {
	if (relPath.startsWith("admin/")) return true;
	if (relPath.startsWith("sw/")) return true;
	return false;
}

/** @type {string[]} */
const violations = [];

for (const file of walkTsFiles(endpointsRoot)) {
	const relPath = relative(endpointsRoot, file).replace(/\\/g, "/").replace(/\.ts$/, "");
	const content = readFileSync(file, "utf8");
	const meta = parseMetaFlags(content);
	if (meta == null) continue;

	if (!meta.requireCredential) continue;
	if (meta.requireModerator || meta.requireAdmin) continue;
	if (meta.secure) continue;
	if (isAllowlistedWithoutKind(relPath)) continue;
	if (meta.kind) continue;

	violations.push(relPath);
}

if (violations.length > 0) {
	console.error("meta.kind が未設定のエンドポイント:");
	for (const path of violations.sort()) {
		console.error(`  - ${path}`);
	}
	process.exit(1);
}

console.log("audit-endpoint-kinds: OK（対象エンドポイントはすべて meta.kind が設定済み）");
