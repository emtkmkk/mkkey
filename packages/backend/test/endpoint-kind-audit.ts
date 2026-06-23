/**
 * @packageDocumentation
 *
 * エンドポイント `meta.kind` の静的監査テスト。
 *
 * @remarks
 * `scripts/audit-endpoint-kinds.mjs` と同じ方針で、
 * アプリトークン向けに `kind` が必要なエンドポイントの設定漏れを検出する。
 * エンドポイント一覧の import は config 依存を避けるため行わない。
 *
 * @internal
 */
import * as assert from "assert";
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
 * @param {string} content
 */
function parseMetaFlags(content) {
	const metaMatch = content.match(/export const meta\s*=\s*\{([\s\S]*?)\}\s*as const/);
	if (metaMatch == null) {
		return null;
	}
	const block = metaMatch[1];
	const has = (pattern) => pattern.test(block);
	const kindMatch = block.match(/^\s*kind:\s*["']([^"']+)["']/m);
	return {
		requireCredential: has(/requireCredential:\s*true/),
		requireModerator: has(/requireModerator:\s*true/),
		requireAdmin: has(/requireAdmin:\s*true/),
		secure: has(/secure:\s*true/),
		kind: kindMatch?.[1] ?? null,
	};
}

/** @param {string} relPath */
function isAllowlistedWithoutKind(relPath) {
	if (relPath.startsWith("admin/")) return true;
	if (relPath.startsWith("sw/")) return true;
	return false;
}

/**
 * @param {string} relPath
 */
function readMeta(relPath) {
	const file = join(endpointsRoot, `${relPath}.ts`);
	return parseMetaFlags(readFileSync(file, "utf8"));
}

describe("エンドポイント meta.kind 監査", () => {
	it("requireCredential かつ secure でない非 admin エンドポイントには meta.kind がある", () => {
		/** @type {string[]} */
		const violations = [];

		for (const file of walkTsFiles(endpointsRoot)) {
			const relPath = relative(endpointsRoot, file).replace(/\\/g, "/").replace(/\.ts$/, "");
			const meta = parseMetaFlags(readFileSync(file, "utf8"));
			if (meta == null) continue;
			if (!meta.requireCredential) continue;
			if (meta.requireModerator || meta.requireAdmin) continue;
			if (meta.secure) continue;
			if (isAllowlistedWithoutKind(relPath)) continue;
			if (meta.kind != null) continue;
			violations.push(relPath);
		}

		assert.strictEqual(
			violations.length,
			0,
			`meta.kind 未設定: ${violations.join(", ")}`,
		);
	});

	it("i エンドポイントは read:account スコープを要求する", () => {
		const meta = readMeta("i");
		assert.ok(meta != null);
		assert.strictEqual(meta.kind, "read:account");
	});

	it("notes/timeline エンドポイントは read:account スコープを要求する", () => {
		const meta = readMeta("notes/timeline");
		assert.ok(meta != null);
		assert.strictEqual(meta.kind, "read:account");
	});

	it("i/change-password は secure のため meta.kind がなくてよい", () => {
		const meta = readMeta("i/change-password");
		assert.ok(meta != null);
		assert.strictEqual(meta.secure, true);
		assert.strictEqual(meta.kind, null);
	});
});
