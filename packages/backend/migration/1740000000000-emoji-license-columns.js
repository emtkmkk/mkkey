/**
 * 絵文字テーブルにライセンス個別カラムを追加し、既存 license をパースして移行する
 *
 * 新カラム: copyPermission, licenseName, usageInfo, creator, description, isBasedOnUrl, isTextOnly
 * copyPermission は DB で a/d/c/n の1文字で保存する。
 * 既存 license はパース可能な場合のみ「残り」で上書き（補足情報）。パース失敗時は license はそのまま。
 */
function toStoredCopyPermission(full) {
	if (full == null || full === "") return null;
	const map = { allow: "a", deny: "d", conditional: "c", none: "n" };
	return map[String(full).toLowerCase()] ?? full;
}

function parseLicenseString(licenseStr) {
	if (licenseStr == null || licenseStr === "") {
		return {
			copyPermission: null,
			licenseName: null,
			usageInfo: null,
			creator: null,
			description: null,
			isBasedOnUrl: null,
			remainder: "",
			isTextOnly: false,
		};
	}
	const trimmed = String(licenseStr).trim();
	if (trimmed === "文字だけ") {
		return {
			copyPermission: "a",
			licenseName: "CC0 1.0 Universal",
			usageInfo: null,
			creator: null,
			description: null,
			isBasedOnUrl: null,
			remainder: "",
			isTextOnly: true,
		};
	}
	const RE_COPY = /コピー可否\s*:\s*(\w+)(?:,|$)/;
	const RE_LICENSE = /ライセンス\s*:\s*([^,]+)(?:,|$)/;
	const RE_USAGE = /使用情報\s*:\s*([^,]+)(?:,|$)/;
	// 作者 / 製作者 のいずれにも対応（後方互換）
	const RE_CREATOR = /(?:作者|製作者)\s*:\s*([^,]+)(?:,|$)/;
	const RE_DESC = /説明\s*:\s*([^,]+)(?:,|$)/;
	const RE_BASED = /コピー元\s*:\s*([^,]+)(?:,|$)/;
	const copyPermission = RE_COPY.exec(trimmed)?.[1] ?? null;
	const licenseName = RE_LICENSE.exec(trimmed)?.[1]?.trim() ?? null;
	const usageInfo = RE_USAGE.exec(trimmed)?.[1]?.trim() ?? null;
	const creator = RE_CREATOR.exec(trimmed)?.[1]?.trim() ?? null;
	const description = RE_DESC.exec(trimmed)?.[1]?.trim() ?? null;
	const isBasedOnUrl = RE_BASED.exec(trimmed)?.[1]?.trim() ?? null;
	const hasAny =
		copyPermission != null ||
		licenseName != null ||
		usageInfo != null ||
		creator != null ||
		description != null ||
		isBasedOnUrl != null;
	if (!hasAny) return null;
	let remainder = trimmed;
	for (const re of [RE_COPY, RE_LICENSE, RE_USAGE, RE_CREATOR, RE_DESC, RE_BASED]) {
		remainder = remainder.replace(re, "").replace(/,+\s*,/g, ",").trim();
	}
	remainder = remainder.replace(/^,\s*|\s*,$/g, "").trim();
	return {
		copyPermission: toStoredCopyPermission(copyPermission),
		licenseName,
		usageInfo,
		creator,
		description,
		isBasedOnUrl,
		remainder,
		isTextOnly: false,
	};
}

function escapeSql(str) {
	if (str == null) return "NULL";
	return "'" + String(str).replace(/'/g, "''") + "'";
}

export class EmojiLicenseColumns1740000000000 {
	name = "EmojiLicenseColumns1740000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "copyPermission" character varying(1)`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "licenseName" text`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "usageInfo" text`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "creator" character varying(256)`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "description" text`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "isBasedOnUrl" character varying(512)`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "isTextOnly" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "sensitive" boolean NOT NULL DEFAULT false`,
		);

		const result = await queryRunner.query(
			`SELECT "id", "license" FROM "emoji" WHERE "license" IS NOT NULL AND "license" != ''`,
		);
		const rows = result.rows ?? result;
		for (const row of rows) {
			const parsed = parseLicenseString(row.license);
			if (parsed == null) continue;
			const set = [
				`"copyPermission" = ${escapeSql(parsed.copyPermission)}`,
				`"licenseName" = ${escapeSql(parsed.licenseName)}`,
				`"usageInfo" = ${escapeSql(parsed.usageInfo)}`,
				`"creator" = ${escapeSql(parsed.creator)}`,
				`"description" = ${escapeSql(parsed.description)}`,
				`"isBasedOnUrl" = ${escapeSql(parsed.isBasedOnUrl)}`,
				`"isTextOnly" = ${parsed.isTextOnly}`,
				`"license" = ${escapeSql(parsed.remainder)}`,
			].join(", ");
			await queryRunner.query(
				`UPDATE "emoji" SET ${set} WHERE "id" = ${escapeSql(row.id)}`,
			);
		}
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "sensitive"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "isTextOnly"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "isBasedOnUrl"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "description"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "creator"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "usageInfo"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "licenseName"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "copyPermission"`);
	}
}
