/**
 * @packageDocumentation
 *
 * ActivityPub の Flag（通報）オブジェクトのレンダリング
 *
 * @remarks
 * - **役割**: 通報 API からリモートインスタンスへ Flag アクティビティを送る際のペイロードを組み立てる。
 *
 * @see {@link server/api/endpoints/users/report-abuse} 通報 API
 * @internal
 */
import config from "@/config/index.js";
import { IObject, IActivity } from "@/remote/activitypub/type.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { IRemoteUser } from "@/models/entities/user.js";
import { getInstanceActor } from "@/services/instance-actor.js";

// 通報者を匿名化するため、通報の actor はシステムユーザーである必要がある
// object は uri または uri の配列である必要がある
export const renderFlag = (
	user: ILocalUser,
	object: [string],
	content: string,
) => {
	return {
		type: "Flag",
		actor: `${config.url}/users/${user.id}`,
		content,
		object,
	};
};
