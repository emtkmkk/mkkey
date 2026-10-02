/**
 * @packageDocumentation
 *
 * Bluesky ブリッジで、mkkey のローカルユーザーに発行した AT Protocol の身元（DID・ハンドル・鍵）。
 *
 * @remarks
 * - 1 行 = オプトインしたローカルユーザー 1 人。オプトインしていない人の行は無い。
 * - このユーザーの名義で、自前 PDS のレポジトリに follow / like / プロフィールを書く。投稿は書かない。
 * - レポジトリの中身（ブロック）は {@link AtprotoRepoBlock} に、ここには最新のコミットだけを持つ。
 * - WARNING: `signingPrivateKey` と `rotationPrivateKey` は秘密鍵。API で返したり、ログに出したりしないこと。
 *   `rotationPrivateKey` が漏れると DID そのものを乗っ取られる（PLC の操作を書き換えられる）。
 *   漏れたと分かったら、別の鍵で PLC の操作をし直す必要がある。
 * - NOTE: ActivityPub の秘密鍵（`user_keypair`）と同じく、データベースにはそのまま保存する。
 *   IDEA: rotation 鍵だけはサーバー全体の鍵を設定ファイルに持ち、データベースから外す案もある
 *   （公式 PDS はそうしている）。DID を乗っ取られる危険が減る。
 * - ユーザーを消すと行も消える（CASCADE）。その前に、DID の無効化（PLC の tombstone）を済ませること。
 *
 * @public
 */
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	OneToOne,
	PrimaryColumn,
} from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";

// #region 型

/**
 * 身元の状態。
 *
 * @remarks
 * - active: 使える。レポジトリへの書き込みと、Relay への配信をする
 * - deactivated: オプトインを外した。書き込みも配信もしない。`getRepoStatus` では無効と答える
 *
 * 値を増やすときは、PDS の `getRepoStatus` と firehose の `#account` イベントの返し方も合わせて決めること。
 */
export type AtprotoIdentityStatus = "active" | "deactivated";

// #endregion

/**
 * ローカルユーザーの AT Protocol の身元。
 *
 * @remarks
 * - `did` と `handle` はどちらも一意。ハンドルはローカルユーザーの username から作る（`_` を `-` にして小文字にする）。
 * - `repoRev` / `repoCommitCid` が null のときは、まだ最初のコミットを作っていない。
 * - `plcRegisteredAt` が null のときは、まだ plc.directory に DID を登録できていない（登録に失敗して再試行を待っている状態を含む）。
 *
 * @public
 */
@Entity()
export class AtprotoIdentity {
	// #region 対象のユーザー

	/** 対象のローカルユーザー。1 人につき 1 行 */
	@PrimaryColumn(id())
	public userId: User["id"];

	@OneToOne((type) => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	// #endregion

	// #region 身元

	/** 発行した DID（例: `did:plc:ewvi7nxzyoun6zhxrhs64oiz`） */
	@Index({ unique: true })
	@Column("varchar", {
		length: 256,
		comment: "The DID issued to the user.",
	})
	public did: string;

	/** 今のハンドル（例: `alice.bsky.mkkey.net`）。小文字で保存する */
	@Index({ unique: true })
	@Column("varchar", {
		length: 253,
		comment: "The current handle of the user (lowercase).",
	})
	public handle: string;

	/** 状態 */
	@Column("varchar", {
		length: 16,
		default: "active",
		comment: "Status of the identity (active / deactivated).",
	})
	public status: AtprotoIdentityStatus;

	// #endregion

	// #region 鍵

	/**
	 * レポジトリのコミットに署名する secp256k1 の秘密鍵（16 進数）。
	 *
	 * @remarks
	 * WARNING: 秘密鍵。API で返したり、ログに出したりしないこと。
	 */
	@Column("varchar", {
		length: 128,
		comment: "secp256k1 private key for signing repo commits (hex). SECRET.",
	})
	public signingPrivateKey: string;

	/**
	 * PLC の操作に署名する secp256k1 の秘密鍵（16 進数）。
	 *
	 * @remarks
	 * WARNING: 秘密鍵。漏れると DID を乗っ取られる。API で返したり、ログに出したりしないこと。
	 */
	@Column("varchar", {
		length: 128,
		comment: "secp256k1 private key for signing PLC operations (hex). SECRET.",
	})
	public rotationPrivateKey: string;

	// #endregion

	// #region レポジトリの状態

	/** 最新のコミットの rev（TID）。まだコミットが無ければ null */
	@Column("varchar", {
		length: 16,
		nullable: true,
		comment: "The rev (TID) of the latest commit.",
	})
	public repoRev: string | null;

	/** 最新のコミットの CID。まだコミットが無ければ null */
	@Column("varchar", {
		length: 128,
		nullable: true,
		comment: "The CID of the latest commit.",
	})
	public repoCommitCid: string | null;

	// #endregion

	// #region 日時

	@Column("timestamp with time zone", {
		comment: "The created date of the AtprotoIdentity.",
	})
	public createdAt: Date;

	@Column("timestamp with time zone", {
		comment: "The updated date of the AtprotoIdentity.",
	})
	public updatedAt: Date;

	/** plc.directory に DID を登録できた日時。まだなら null */
	@Column("timestamp with time zone", {
		nullable: true,
		comment: "When the DID was registered to the PLC directory.",
	})
	public plcRegisteredAt: Date | null;

	// #endregion
}
