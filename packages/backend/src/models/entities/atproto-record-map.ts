/**
 * @packageDocumentation
 *
 * Bluesky ブリッジで、AT Protocol のレコード（`at://` URI）と mkkey のデータの対応を持つ。
 *
 * @remarks
 * 次の 3 種類の対応を、この 1 つのテーブルで持つ。
 *
 * | 種類 | `collection` | `userId` | `noteId` | `followeeId` |
 * | --- | --- | --- | --- | --- |
 * | 取り込んだ投稿 | `app.bsky.feed.post` | 投稿した Bluesky ユーザー | 作った Note | null |
 * | mkkey から送った like | `app.bsky.feed.like` | リアクションしたローカルユーザー | リアクション先の Note | null |
 * | mkkey から送った follow | `app.bsky.graph.follow` | フォローしたローカルユーザー | null | フォロー先の Bluesky ユーザー |
 *
 * - 取り込んだ投稿の対応は、like を送るときの `subject`（URI と CID の組）を作るのに使う。Note の `uri` だけでは CID が分からないため。
 * - `noteId` / `followeeId` には、わざと外部キーを付けていない。Note やフォローが消えたときに対応が一緒に消えると、
 *   Bluesky 側に書いた like / follow を消せなくなるため。対応は、レコードを消した処理の側で消すこと。
 * - `createdByBridge` が false の行は、mkkey が書いたものではない（連携アカウントに元からあった follow を使い回した場合）。
 *   mkkey 側でフォローを外しても、そのレコードは消さない。
 *
 * @public
 */
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";
import { Note } from "./note.js";

// #region 型

/**
 * 対応を持つレコードの種類（NSID）。
 *
 * @remarks
 * 値を増やすときは、上の表と、同じ種類の重複を防ぐ一意の索引の考え方を見直すこと。
 */
export type AtprotoRecordCollection =
	| "app.bsky.feed.post"
	| "app.bsky.feed.like"
	| "app.bsky.graph.follow";

// #endregion

/**
 * AT Protocol のレコード 1 件と、mkkey のデータの対応。
 *
 * @remarks
 * - 1 人が 1 つの Note に持てる like は 1 件、1 人が 1 人に持てる follow は 1 件。一意の索引で保証する。
 * - 取り込んだ投稿も「1 つの Note に 1 件」になる（投稿者は 1 人なので、同じ索引で保証される）。
 *
 * @public
 */
@Entity()
@Index(["userId", "collection", "noteId"], {
	unique: true,
	where: `"noteId" IS NOT NULL`,
})
@Index(["userId", "collection", "followeeId"], {
	unique: true,
	where: `"followeeId" IS NOT NULL`,
})
export class AtprotoRecordMap {
	// #region 識別子

	@PrimaryColumn(id())
	public id: string;

	@Column("timestamp with time zone", {
		comment: "The created date of the AtprotoRecordMap.",
	})
	public createdAt: Date;

	/** レコードの URI（例: `at://did:plc:xxx/app.bsky.feed.like/3kxxx`） */
	@Index({ unique: true })
	@Column("varchar", {
		length: 512,
		comment: "The at:// URI of the record.",
	})
	public uri: string;

	/** レコードの CID。like の `subject` を作るのに使う */
	@Column("varchar", {
		length: 128,
		comment: "The CID of the record.",
	})
	public cid: string;

	/** レコードの種類（NSID） */
	@Column("varchar", {
		length: 128,
		comment: "The collection (NSID) of the record.",
	})
	public collection: AtprotoRecordCollection;

	// #endregion

	// #region 対応先

	/** レコードを持っている人（投稿なら Bluesky ユーザー、like / follow ならローカルユーザー） */
	@Index()
	@Column({
		...id(),
		comment: "The owner of the record.",
	})
	public userId: User["id"];

	@ManyToOne((type) => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	/**
	 * 対応する Note（投稿なら作った Note、like ならリアクション先の Note）。
	 *
	 * @remarks
	 * NB: 外部キーは付けていない。Note が消えても、この行は残る（ファイル先頭の説明を参照）。
	 */
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: "The related note. No foreign key on purpose.",
	})
	public noteId: Note["id"] | null;

	/**
	 * フォロー先の Bluesky ユーザー（follow のときだけ）。
	 *
	 * @remarks
	 * NB: 外部キーは付けていない。フォローが消えても、この行は残る（ファイル先頭の説明を参照）。
	 */
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: "The followee of a follow record. No foreign key on purpose.",
	})
	public followeeId: User["id"] | null;

	/** mkkey が書いたレコードか。false なら mkkey 側の操作で消してはいけない */
	@Column("boolean", {
		default: true,
		comment: "Whether the bridge created this record.",
	})
	public createdByBridge: boolean;

	// #endregion
}
