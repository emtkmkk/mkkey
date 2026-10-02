/**
 * Bluesky ブリッジの firehose（subscribeRepos）で流す出来事のテーブル atproto_repo_seq を追加する。
 *
 * @remarks
 * - seq は bigserial（自動で増える通し番号）。Relay はこの番号で、どこまで読んだかを覚える。
 * - did は外部キーにしない。身元を消しても、すでに流した出来事の記録は Relay の読み直しのために残すため。
 * - down はテーブルを消すだけ。Relay が覚えている番号と合わなくなるので、本番で down した後は
 *   Relay にもう一度 requestCrawl する必要がある。
 *
 * @internal
 */
export class AtprotoRepoSeq1790985600000 {
	name = "AtprotoRepoSeq1790985600000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "atproto_repo_seq" (
				"seq" BIGSERIAL NOT NULL,
				"did" character varying(256) NOT NULL,
				"type" character varying(16) NOT NULL,
				"event" bytea NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				CONSTRAINT "PK_atproto_repo_seq_seq" PRIMARY KEY ("seq")
			)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_repo_seq_did" ON "atproto_repo_seq" ("did")`,
		);
		// 古い行を消すときに使う
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_repo_seq_createdAt" ON "atproto_repo_seq" ("createdAt")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_repo_seq"`);
	}
}
