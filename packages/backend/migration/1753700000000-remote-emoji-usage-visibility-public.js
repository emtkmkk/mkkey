/**
 * リモート絵文字の usageVisibility を public に正規化する。
 *
 * emoji.usageVisibility はカラムのデフォルトが 'private' のため、
 * ActivityPub 経由で取り込んだリモート絵文字（usageVisibility を指定しない INSERT）が
 * すべて private として保存され、/emoji/:path が 404 を返していた。
 * usageVisibility は自インスタンスの絵文字の使用可否を表す概念であり、
 * リモート絵文字には適用しないため、既存データを public に揃える。
 */
export class RemoteEmojiUsageVisibilityPublic1753700000000 {
	name = "RemoteEmojiUsageVisibilityPublic1753700000000";

	async up(queryRunner) {
		await queryRunner.query(
			`UPDATE "emoji" SET "usageVisibility" = 'public' WHERE "host" IS NOT NULL AND "usageVisibility" IS DISTINCT FROM 'public'`,
		);
	}

	async down(queryRunner) {
		// 元の値は復元できないため何もしない
	}
}
