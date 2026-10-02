/**
 * @packageDocumentation
 *
 * Bluesky ブリッジの自前 PDS が持つ画像（blob）。
 *
 * @remarks
 * - 今はプロフィールのアイコンとバナーだけを入れる。投稿の画像を送るようになったら、同じテーブルを使う想定。
 * - 中身は Bluesky の制限に合わせて変換した後のバイト列。Bluesky 側は CID で中身を確かめるので、
 *   元のドライブのファイルではなく、変換後のものを持つ必要がある。
 * - `com.atproto.sync.getBlob` で外に出す。
 * - 身元（{@link AtprotoIdentity}）を消すと、blob も消える（CASCADE）。
 * - TODO: アイコンを変えた後の、どのレコードからも使われなくなった blob を消す処理。
 *   1 人あたり 1MB 以下の画像が変更のたびに 1〜2 枚増えるだけなので、オプトインの人数が少ないうちは放置でよい。
 *
 * @public
 */
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { id } from "../id.js";
import { AtprotoIdentity } from "./atproto-identity.js";
import type { DriveFile } from "./drive-file.js";

/**
 * blob の使い道。
 *
 * @remarks
 * 使い道ごとに変換の大きさが違うので、同じドライブのファイルでも別の blob になる。
 * 値を増やすときは、マイグレーションの列の長さ（16 文字）に収めること。
 */
export type AtprotoBlobPurpose = "avatar" | "banner";

/**
 * 自前 PDS の blob 1 個。
 *
 * @remarks
 * 書き込んだ後に中身を変えることはない（CID は中身から決まるため）。
 *
 * @public
 */
@Entity()
@Index(["userId", "sourceFileId", "purpose"])
export class AtprotoBlob {
	/** blob の持ち主（{@link AtprotoIdentity.userId}） */
	@PrimaryColumn(id())
	public userId: AtprotoIdentity["userId"];

	@ManyToOne((type) => AtprotoIdentity, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "userId", referencedColumnName: "userId" })
	public identity: AtprotoIdentity | null;

	/** blob の CID（raw 形式。例: `bafkrei...`） */
	@PrimaryColumn("varchar", {
		length: 128,
		comment: "The CID of the blob.",
	})
	public cid: string;

	/** 使い道 */
	@Column("varchar", {
		length: 16,
		comment: "What the blob is used for (avatar / banner).",
	})
	public purpose: AtprotoBlobPurpose;

	/**
	 * 変換元のドライブのファイル。
	 *
	 * @remarks
	 * わざと外部キーにしていない。ドライブのファイルを消しても、Bluesky のプロフィールが指している blob は残す必要があるため。
	 */
	@Column({
		...id(),
		nullable: true,
		comment: "The drive file that this blob was converted from.",
	})
	public sourceFileId: DriveFile["id"] | null;

	/** 中身の MIME タイプ（例: `image/jpeg`） */
	@Column("varchar", {
		length: 64,
		comment: "The MIME type of the blob.",
	})
	public mimeType: string;

	/** 中身のバイト数 */
	@Column("integer", {
		comment: "The size of the blob in bytes.",
	})
	public size: number;

	/** 中身 */
	@Column("bytea", {
		comment: "The content of the blob.",
	})
	public content: Buffer;

	@Column("timestamp with time zone", {
		comment: "The created date of the AtprotoBlob.",
	})
	public createdAt: Date;
}
