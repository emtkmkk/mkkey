/**
 * @packageDocumentation
 *
 * フォロー関係のユーザーを ActivityPub 用 URL に変換する
 *
 * @remarks
 * - **役割**: フォロワー/フォロー一覧の AP コレクションでユーザー ID を AP URL に変換する。
 *
 * @see {@link server/activitypub/followers} フォロワー
 * @internal
 */
import config from "@/config/index.js";
import { Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";

/**
 * (ローカル|リモート)(フォロワー|フォロイー)ID を URL に変換する
 * @param id フォロワーまたはフォロイーの ID
 */
export default async function renderFollowUser(id: User["id"]): Promise<any> {
	const user = await Users.findOneByOrFail({ id: id });
	return Users.isLocalUser(user) ? `${config.url}/users/${user.id}` : user.uri;
}
