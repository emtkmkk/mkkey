/**
 * 空 references Collection 由来の hasReferences 誤設定を一括修正する。
 *
 * @remarks
 * NOTE: referenceIds が空のまま hasReferences=true になっているリモート投稿を対象とする。
 * NOTE: followers 限定参照で totalItems のみが手がかりの既存行も false になる可能性がある。
 */
export class FixHasReferencesEmptyShell1743300000000 {
	name = "FixHasReferencesEmptyShell1743300000000";

	async up(queryRunner) {
		await queryRunner.query(`
			UPDATE "note"
			SET "hasReferences" = false
			WHERE "userHost" IS NOT NULL
				AND "hasReferences" = true
				AND cardinality("referenceIds") = 0
		`);
	}

	async down(queryRunner) {
		// 誤設定だった行と正しく totalItems のみで true だった行を区別できないため復元しない
	}
}
