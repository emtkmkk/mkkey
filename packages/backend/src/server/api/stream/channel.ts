/**
 * @packageDocumentation
 *
 * ストリームのチャンネル基底クラス。各チャンネルは購読・メッセージ配送の単位。
 *
 * @remarks
 * - **役割**: main / homeTimeline / drive 等の各チャンネルが継承する抽象クラス。chName・init・購読処理を定義する。
 * - サブクラスは stream/channels にあり、index で一覧 export される。
 *
 * @see {@link stream/channels/index} チャンネル一覧
 * @internal
 */
import type Connection from ".";
import type { Note } from "@/models/entities/note.js";
import { Notes } from "@/models/index.js";
import type { Packed } from "@/misc/schema.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";

/**
 * ストリームチャンネル
 */
export default abstract class Channel {
	protected connection: Connection;
	public id: string;
	public abstract readonly chName: string;
	public static readonly shouldShare: boolean;
	public static readonly requireCredential: boolean;

	protected get user() {
		return this.connection.user;
	}

	protected get userProfile() {
		return this.connection.userProfile;
	}

	protected get following() {
		return this.connection.following;
	}

	protected get muting() {
		return this.connection.muting;
	}

	protected get renoteMuting() {
		return this.connection.renoteMuting;
	}

	protected get blocking() {
		return this.connection.blocking;
	}

	protected get followingChannels() {
		return this.connection.followingChannels;
	}

	protected get subscriber() {
		return this.connection.subscriber;
	}

	constructor(id: string, connection: Connection) {
		this.id = id;
		this.connection = connection;
	}

	public send(typeOrPayload: any, payload?: any) {
		const type = payload === undefined ? typeOrPayload.type : typeOrPayload;
		const body = payload === undefined ? typeOrPayload.body : payload;

		this.connection.sendMessageToWs("channel", {
			id: this.id,
			type: type,
			body: body,
		});
	}

	protected withPackedNote(
		callback: (note: Packed<"Note">) => void,
	): (Note) => void {
		return async (note: Note) => {
			try {
				// 以前 JSON.stringify されたため、オブジェクトだったフィールドは
				// 文字列になっているので復元するかオブジェクトから除去する
				note.createdAt = new Date(note.createdAt);
				note.reply = undefined;
				note.renote = undefined;
				note.user = undefined;
				note.channel = undefined;

				const packed = await Notes.pack(note, this.user, { detail: true });

				// スキップ: ユーザーに非表示のノート
				if (packed.invisible) return;

				callback(packed);
			} catch (err) {
				if (
					err instanceof IdentifiableError &&
					err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24"
				) {
					// スキップ: ユーザーに非表示のノート
					return;
				} else {
					throw err;
				}
			}
		};
	}

	public abstract init(params: any): void;
	public dispose?(): void;
	public onMessage?(type: string, body: any): void;
}
