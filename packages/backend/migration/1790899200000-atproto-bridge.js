/**
 * Bluesky ブリッジの土台になるテーブル atproto_identity / atproto_repo_block / atproto_record_map を追加する。
 *
 * @remarks
 * - atproto_identity: ローカルユーザーに発行した DID・ハンドル・鍵。ユーザーが消えたら消える（CASCADE）。
 * - atproto_repo_block: 自前 PDS のレポジトリの中身。身元が消えたら消える（CASCADE）。
 * - atproto_record_map: `at://` のレコードと Note・フォローの対応。
 *   noteId / followeeId には、わざと外部キーを付けていない。Note やフォローが消えたときに対応まで消えると、
 *   Bluesky 側に書いた like / follow を消せなくなるため。
 * - Bluesky ユーザー本人の情報（DID・ハンドル）を持つ atproto_actor は、受信を作る段階で別のマイグレーションとして足す。
 * - WARNING: down はテーブルを消すだけ。発行した DID の鍵も消えるので、本番で down すると
 *   その DID は二度と操作できなくなる（plc.directory 上に残り続ける）。本番で戻すときは鍵を退避してから行うこと。
 *
 * @internal
 */
export class AtprotoBridge1790899200000 {
	name = "AtprotoBridge1790899200000";

	async up(queryRunner) {
		// #region atproto_identity
		await queryRunner.query(
			`CREATE TABLE "atproto_identity" (
				"userId" character varying(32) NOT NULL,
				"did" character varying(256) NOT NULL,
				"handle" character varying(253) NOT NULL,
				"status" character varying(16) NOT NULL DEFAULT 'active',
				"signingPrivateKey" character varying(128) NOT NULL,
				"rotationPrivateKey" character varying(128) NOT NULL,
				"repoRev" character varying(16),
				"repoCommitCid" character varying(128),
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"plcRegisteredAt" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_atproto_identity_userId" PRIMARY KEY ("userId")
			)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_identity_did" ON "atproto_identity" ("did")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_identity_handle" ON "atproto_identity" ("handle")`,
		);
		await queryRunner.query(
			`ALTER TABLE "atproto_identity" ADD CONSTRAINT "FK_atproto_identity_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		// #endregion

		// #region atproto_repo_block
		await queryRunner.query(
			`CREATE TABLE "atproto_repo_block" (
				"userId" character varying(32) NOT NULL,
				"cid" character varying(128) NOT NULL,
				"repoRev" character varying(16) NOT NULL,
				"size" integer NOT NULL,
				"content" bytea NOT NULL,
				CONSTRAINT "PK_atproto_repo_block_userId_cid" PRIMARY KEY ("userId", "cid")
			)`,
		);
		// getRepo の since（ある rev より後の差分）で使う
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_repo_block_userId_repoRev" ON "atproto_repo_block" ("userId", "repoRev")`,
		);
		await queryRunner.query(
			`ALTER TABLE "atproto_repo_block" ADD CONSTRAINT "FK_atproto_repo_block_userId" FOREIGN KEY ("userId") REFERENCES "atproto_identity"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		// #endregion

		// #region atproto_record_map
		await queryRunner.query(
			`CREATE TABLE "atproto_record_map" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"uri" character varying(512) NOT NULL,
				"cid" character varying(128) NOT NULL,
				"collection" character varying(128) NOT NULL,
				"userId" character varying(32) NOT NULL,
				"noteId" character varying(32),
				"followeeId" character varying(32),
				"createdByBridge" boolean NOT NULL DEFAULT true,
				CONSTRAINT "PK_atproto_record_map_id" PRIMARY KEY ("id")
			)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_record_map_uri" ON "atproto_record_map" ("uri")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_record_map_userId" ON "atproto_record_map" ("userId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_record_map_noteId" ON "atproto_record_map" ("noteId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_record_map_followeeId" ON "atproto_record_map" ("followeeId")`,
		);
		// 1 人が 1 つの Note に持てる like は 1 件、1 人が 1 人に持てる follow は 1 件
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_record_map_userId_collection_noteId" ON "atproto_record_map" ("userId", "collection", "noteId") WHERE "noteId" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_atproto_record_map_userId_collection_followeeId" ON "atproto_record_map" ("userId", "collection", "followeeId") WHERE "followeeId" IS NOT NULL`,
		);
		// noteId / followeeId には外部キーを付けない（ファイル先頭の説明を参照）
		await queryRunner.query(
			`ALTER TABLE "atproto_record_map" ADD CONSTRAINT "FK_atproto_record_map_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		// #endregion
	}

	async down(queryRunner) {
		// 外部キーで参照される側（atproto_identity）を最後に消す
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_record_map"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_repo_block"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_identity"`);
	}
}
