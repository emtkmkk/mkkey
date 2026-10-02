/**
 * Bluesky ブリッジで取り込んだ Bluesky ユーザーの情報を持つテーブル atproto_actor を追加する。
 *
 * @remarks
 * - 1 行 = mkkey のリモートユーザー（user）1 人。user が消えたら一緒に消える（CASCADE）。
 * - did は一意。Bluesky ユーザーを見分ける、変わらない値。
 * - handle は一意にしない。ハンドルは手放されて別の人が取ることがあり、保存した時点ではぶつかりうるため。
 *   探すときに使うので索引だけ付ける（小文字で保存する）。
 * - down はテーブルを消すだけ。user の行は残るが、DID との対応が分からなくなるので、
 *   本番で down した後は Bluesky ユーザーを取り込み直す必要がある。
 *
 * @internal
 */
export class AtprotoActor1791158400000 {
	name = "AtprotoActor1791158400000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "atproto_actor" (
				"userId" character varying(32) NOT NULL,
				"did" character varying(256) NOT NULL,
				"handle" character varying(256) NOT NULL,
				"pdsHost" character varying(256),
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				CONSTRAINT "PK_atproto_actor_userId" PRIMARY KEY ("userId")
			)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_actor_did" ON "atproto_actor" ("did")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_actor_handle" ON "atproto_actor" ("handle")`,
		);
		await queryRunner.query(
			`ALTER TABLE "atproto_actor" ADD CONSTRAINT "FK_atproto_actor_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_actor"`);
	}
}
