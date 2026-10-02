/**
 * @packageDocumentation
 *
 * Bluesky ブリッジで取り込んだ Bluesky ユーザーと、DID・ハンドルの対応。
 *
 * @remarks
 * - Bluesky ユーザーは mkkey のリモートユーザー（{@link User}）として持つ。その `username` は DID から作った固定の ID、
 *   `host` は設定の `atproto.bridgeHost`（例: `bsky.mkkey.net`）。今のハンドルはこのテーブルに持つ。
 * - ハンドルは一意にしない（手放されて別の人が取ることがあるため）。同じハンドルの行が 2 つ見つかったら、
 *   Bluesky 側で今の持ち主を確かめてから使うこと。
 * - TODO: 取り込みの停止の状態（ブロックされた・`#nobridge`）は、同意の判定（実装手順 10）で足す。
 *
 * @see {@link ../../remote/atproto/actor.ts} 取り込みと更新
 * @public
 */
import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";

/**
 * 取り込んだ Bluesky ユーザー 1 人。
 *
 * @remarks
 * user の行と 1 対 1。user が消えたら一緒に消える。
 *
 * @public
 */
@Entity()
export class AtprotoActor {
	/** 対応する mkkey のリモートユーザー */
	@PrimaryColumn(id())
	public userId: User["id"];

	@OneToOne((type) => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	/** DID（例: `did:plc:ewvi7nxzyoun6zhxrhs64oiz`）。変わらない */
	@Index({ unique: true })
	@Column("varchar", {
		length: 256,
		comment: "The DID of the Bluesky user.",
	})
	public did: string;

	/**
	 * 今のハンドル（小文字。例: `alice.bsky.social`）。
	 *
	 * @remarks
	 * ハンドルを確かめられなかったときは、Bluesky の決まりどおり `handle.invalid` が入る。
	 */
	@Index()
	@Column("varchar", {
		length: 256,
		comment: "The current handle of the Bluesky user (lowercase).",
	})
	public handle: string;

	/**
	 * アカウントを置いている PDS のホスト名（例: `morel.us-east.host.bsky.network`）。
	 *
	 * @remarks
	 * 今は記録するだけ。スパム用の PDS をまとめて止めたくなったときに使う。調べられなかったときは null。
	 */
	@Column("varchar", {
		length: 256,
		nullable: true,
		comment: "The hostname of the PDS that hosts the account.",
	})
	public pdsHost: string | null;

	@Column("timestamp with time zone", {
		comment: "The created date of the AtprotoActor.",
	})
	public createdAt: Date;

	@Column("timestamp with time zone", {
		comment: "The updated date of the AtprotoActor.",
	})
	public updatedAt: Date;
}
