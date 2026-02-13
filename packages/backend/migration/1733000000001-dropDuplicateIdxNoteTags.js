export class dropDuplicateIdxNoteTags1733000000001 {
	constructor() {
		this.name = "dropDuplicateIdxNoteTags1733000000001";
		this.transaction = false;
	}

	async up(queryRunner) {
		const indexes = await queryRunner.query(
			`SELECT indexname
			 FROM pg_indexes
			 WHERE schemaname = 'public'
			   AND tablename = 'note'
			   AND indexname IN ('IDX_NOTE_TAGS', 'idx_note_tags')`,
			undefined,
		);

		const hasUpper = indexes.some((index) => index.indexname === 'IDX_NOTE_TAGS');
		const hasLower = indexes.some((index) => index.indexname === 'idx_note_tags');

		if (hasUpper && hasLower) {
			await queryRunner.query(
				`DROP INDEX CONCURRENTLY IF EXISTS public."IDX_NOTE_TAGS"`,
				undefined,
			);
		}
	}

	async down(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTE_TAGS" ON public.note USING gin (tags)`,
			undefined,
		);
	}
}
