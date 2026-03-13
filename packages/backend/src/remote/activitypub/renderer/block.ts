/**
 * @packageDocumentation
 *
 * ブロックを ActivityPub 形式にレンダリングする
 *
 * @remarks
 * - **役割**: ブロック一覧の AP 配信時に Block オブジェクトを生成する。
 *
 * @see {@link server/activitypub} ブロック配信
 * @internal
 */
import config from "@/config/index.js";
import type { Blocking } from "@/models/entities/blocking.js";

/**
 * ブロックを ActivityPub 表現にレンダリングする。
 *
 * @param block レンダリングするブロック。blockee リレーションが読み込まれている必要がある。
 */
export function renderBlock(block: Blocking) {
	if (block.blockee?.uri == null) {
		throw new Error("renderBlock: missing blockee uri");
	}

	return {
		type: "Block",
		id: `${config.url}/blocks/${block.id}`,
		actor: `${config.url}/users/${block.blockerId}`,
		object: block.blockee.uri,
	};
}
