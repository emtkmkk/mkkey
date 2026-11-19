/**
 * ローカル範囲を共有するサーバーからのリレー購読。
 * @remarks 通常のユーザーフォローや外部リレーの登録とは分け、Undo は元の Follow ID に一致した場合だけ受け付ける。
 * @packageDocumentation
 * @internal
 */
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./user.js";
import { id } from "../id.js";

/** @internal ローカル投稿フィードを購読する署名検証済みのリモート actor。 */
@Entity("local_relay_subscriber")
export class LocalRelaySubscriber {
	/** @internal 購読者のユーザーID。1 actor につき1購読。 */
	@PrimaryColumn(id())
	public userId: string;

	/** @internal 古い Undo が新しい購読を解除しないための Follow ID。 */
	@Column("varchar", { length: 2048 })
	public followId: string;

	/** @internal 配送先は最新の actor 情報から取得する。 */
	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userId" })
	public user: User;
}
