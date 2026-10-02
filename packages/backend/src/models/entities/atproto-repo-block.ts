/**
 * @packageDocumentation
 *
 * Bluesky ブリッジの自前 PDS が持つ、レポジトリの中身（ブロック）。
 *
 * @remarks
 * - 1 行 = ブロック 1 個（コミット・MST のノード・レコードのどれか）。中身は DAG-CBOR のバイト列のまま持つ。
 * - 同じ CID のブロックは中身も同じなので、ユーザーごとに CID で一意にする。
 * - `repoRev` は「そのブロックが初めて出てきたコミット」の rev。`com.atproto.sync.getRepo` の `since`
 *   （ある rev より後の差分だけを返す）に使う。
 * - 身元（{@link AtprotoIdentity}）を消すと、ブロックも消える（CASCADE）。
 * - NOTE: 古いコミットでしか使われなくなったブロックは、今は消さずに残る。
 *   follow / like しか書かないので、増え方は 1 回の操作で数個のブロック程度と見込んでいる。
 *   OPTIMIZE: 量が増えたら、最新のコミットから辿れないブロックを定期的に消す処理を足す。
 *
 * @public
 */
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { id } from "../id.js";
import { AtprotoIdentity } from "./atproto-identity.js";

/**
 * レポジトリのブロック 1 個。
 *
 * @remarks
 * 書き込んだ後に中身を変えることはない（CID は中身から決まるため）。
 *
 * @public
 */
@Entity()
@Index(["userId", "repoRev"])
export class AtprotoRepoBlock {
	/** レポジトリの持ち主（{@link AtprotoIdentity.userId}） */
	@PrimaryColumn(id())
	public userId: AtprotoIdentity["userId"];

	@ManyToOne((type) => AtprotoIdentity, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "userId", referencedColumnName: "userId" })
	public identity: AtprotoIdentity | null;

	/** ブロックの CID（文字列形式。例: `bafyrei...`） */
	@PrimaryColumn("varchar", {
		length: 128,
		comment: "The CID of the block.",
	})
	public cid: string;

	/** このブロックが初めて出てきたコミットの rev（TID） */
	@Column("varchar", {
		length: 16,
		comment: "The rev of the commit that first included this block.",
	})
	public repoRev: string;

	/** 中身のバイト数 */
	@Column("integer", {
		comment: "The size of the block in bytes.",
	})
	public size: number;

	/** 中身（DAG-CBOR のバイト列） */
	@Column("bytea", {
		comment: "The content of the block (DAG-CBOR bytes).",
	})
	public content: Buffer;
}
