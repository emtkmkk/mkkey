/**
 * カスタム絵文字に Fedibird 互換の情報項目と、参考情報用の列を追加する。
 *
 * @remarks
 * - alternateName / ruby / relatedLinks / copyrightNotice / creditText は Fedibird の Emoji と同じ意味の項目。
 * - orgCategory はローカルにコピーしたときだけ使う「コピー元のカテゴリ」（Fedibird の org_category と同じ意味）。
 * - sourceLicenseText は、リモートから届いた `_misskey_license.freeText` をそのまま残す参考情報。中身は解釈しない。
 * - すべて空を許す（relatedLinks は空配列が既定）ので、既存の行や連合先には影響しない。
 * - down は追加した列を消すだけ。消した列に入っていた値は失われる。
 *
 * @internal
 */
export class EmojiFedibirdFields1790294400000 {
	name = "EmojiFedibirdFields1790294400000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji"
				ADD COLUMN IF NOT EXISTS "alternateName" character varying(512),
				ADD COLUMN IF NOT EXISTS "ruby" character varying(512),
				ADD COLUMN IF NOT EXISTS "relatedLinks" character varying(512) array NOT NULL DEFAULT '{}',
				ADD COLUMN IF NOT EXISTS "copyrightNotice" text,
				ADD COLUMN IF NOT EXISTS "creditText" text,
				ADD COLUMN IF NOT EXISTS "orgCategory" character varying(128),
				ADD COLUMN IF NOT EXISTS "sourceLicenseText" text`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji"
				DROP COLUMN IF EXISTS "sourceLicenseText",
				DROP COLUMN IF EXISTS "orgCategory",
				DROP COLUMN IF EXISTS "creditText",
				DROP COLUMN IF EXISTS "copyrightNotice",
				DROP COLUMN IF EXISTS "relatedLinks",
				DROP COLUMN IF EXISTS "ruby",
				DROP COLUMN IF EXISTS "alternateName"`,
		);
	}
}
