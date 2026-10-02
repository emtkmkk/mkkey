/**
 * @packageDocumentation
 *
 * Bluesky ブリッジの自前 PDS が firehose（`com.atproto.sync.subscribeRepos`）で流す出来事の記録。
 *
 * @remarks
 * - 1 行 = 出来事 1 件（コミット・ハンドルの確認・アカウントの状態）。`seq` が firehose の通し番号になる。
 * - Relay は「どこまで読んだか」を `seq` で覚えていて、つなぎ直したときに続きから読む。
 *   そのため、`seq` は書いた順に増え、途中に後から割り込む番号があってはいけない。
 *   NB: 書き込む側は、同じアドバイザリロックの中で採番すること（{@link ../../remote/atproto/sequencer.ts} を参照）。
 * - `event` には、`seq` を除いた本体を DAG-CBOR にしたものを入れる。送るときに `seq` を足して符号化し直す。
 * - 複数の web ワーカーの、どこに Relay がつないでも同じ内容が読めるよう、メモリではなくデータベースに置く。
 * - TODO: 古い行を消す処理を足す（Relay がつなぎ直せる期間だけ残せばよい。公式 PDS は数日分）。
 *
 * @public
 */
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// #region 型

/**
 * 出来事の種類。
 *
 * @remarks
 * firehose のメッセージの種類（`#commit` / `#identity` / `#account`）から `#` を除いたもの。
 * 値を増やすときは、送る側（subscribeRepos）の対応も足すこと。
 */
export type AtprotoRepoSeqType = "commit" | "identity" | "account";

// #endregion

/**
 * firehose の出来事 1 件。
 *
 * @remarks
 * 書いた後に中身を変えることはない。
 *
 * @public
 */
@Entity()
export class AtprotoRepoSeq {
	/**
	 * 通し番号。
	 *
	 * @remarks
	 * PostgreSQL の bigint は TypeORM では文字列として返る。数として使うときは `Number()` にする
	 * （firehose で送る範囲では、数にしても精度は落ちない）。
	 */
	@PrimaryGeneratedColumn("increment", { type: "bigint" })
	public seq: string;

	/** 対象のアカウントの DID */
	@Index()
	@Column("varchar", {
		length: 256,
		comment: "The DID of the account.",
	})
	public did: string;

	/** 出来事の種類 */
	@Column("varchar", {
		length: 16,
		comment: "The event type (commit / identity / account).",
	})
	public type: AtprotoRepoSeqType;

	/** `seq` を除いた本体（DAG-CBOR） */
	@Column("bytea", {
		comment: "The event body without seq (DAG-CBOR).",
	})
	public event: Buffer;

	@Index()
	@Column("timestamp with time zone", {
		comment: "The created date of the AtprotoRepoSeq.",
	})
	public createdAt: Date;
}
