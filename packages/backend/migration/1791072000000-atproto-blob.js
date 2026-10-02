/**
 * Bluesky ブリッジの自前 PDS が持つ画像（blob）のテーブル atproto_blob を追加する。
 *
 * @remarks
 * - 今はプロフィールのアイコンとバナーだけを入れる。中身は Bluesky の制限（1MB 以下）に合わせて変換した後のバイト列。
 * - Bluesky 側は CID（中身から計算した値）で中身を確かめるので、変換した後のバイト列そのものを持つ必要がある。
 * - (userId, sourceFileId, purpose) の索引は、同じドライブのファイルを何度も変換しないための引き当てに使う。
 * - 身元（atproto_identity）が消えたら一緒に消える（CASCADE）。
 * - down はテーブルを消すだけ。プロフィールのレコードは消えた blob を指したままになるので、
 *   本番で down した後は `admin/atproto/refresh-profile` でプロフィールを書き直すこと。
 *
 * @internal
 */
export class AtprotoBlob1791072000000 {
	name = "AtprotoBlob1791072000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "atproto_blob" (
				"userId" character varying(32) NOT NULL,
				"cid" character varying(128) NOT NULL,
				"purpose" character varying(16) NOT NULL,
				"sourceFileId" character varying(32),
				"mimeType" character varying(64) NOT NULL,
				"size" integer NOT NULL,
				"content" bytea NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				CONSTRAINT "PK_atproto_blob_userId_cid" PRIMARY KEY ("userId", "cid")
			)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_atproto_blob_userId_sourceFileId_purpose" ON "atproto_blob" ("userId", "sourceFileId", "purpose")`,
		);
		await queryRunner.query(
			`ALTER TABLE "atproto_blob" ADD CONSTRAINT "FK_atproto_blob_userId" FOREIGN KEY ("userId") REFERENCES "atproto_identity"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "atproto_blob"`);
	}
}
