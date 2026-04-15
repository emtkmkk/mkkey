/**
 * @packageDocumentation
 *
 * note テーブル上の、クエリパターンと相性が悪い／重複している btree インデックスを削除する。
 *
 * @remarks
 * - **IDX_NOTE_CCUSERIDS**: 可視性は `<@` 中心で btree 配列索引が使われにくい。
 * - **IDX_25dfc71b0369b003a4cd434d0b**: `= ANY(attachedFileTypes)` は配列要素検索のため同様。
 * - **note_renoteid_index**: `renoteId` に対し Init 由来の `IDX_52ccc804d7c69037d558bac4c9` が残るため重複を解消。
 * - **CONCURRENTLY** のためマイグレーションのトランザクションを無効化する。
 *
 * @internal
 */
export class DropNoteRedundantBtreeIndexes1741300000000 {
	constructor() {
		this.name = "DropNoteRedundantBtreeIndexes1741300000000";
		this.transaction = false;
	}

	async up(queryRunner) {
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS public."IDX_NOTE_CCUSERIDS"`,
			undefined,
		);
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS public."IDX_25dfc71b0369b003a4cd434d0b"`,
			undefined,
		);
		await queryRunner.query(
			`DROP INDEX CONCURRENTLY IF EXISTS public.note_renoteid_index`,
			undefined,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTE_CCUSERIDS" ON public.note ("ccUserIds")`,
			undefined,
		);
		await queryRunner.query(
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_25dfc71b0369b003a4cd434d0b" ON public.note ("attachedFileTypes")`,
			undefined,
		);
		await queryRunner.query(
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS note_renoteid_index ON public.note ("renoteId")`,
			undefined,
		);
	}
}
