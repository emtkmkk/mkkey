/**
 * @packageDocumentation
 *
 * インスタンス用のローカル Actor ユーザー（`instance.actor`）を取得または作成する。
 *
 * @remarks
 * - **役割**: AP 等で参照。`Cache.fetch` でコールド時の並列作成を 1 本にまとめる。
 *
 * @internal
 */
import { createSystemUser } from "./create-system-user.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import { Cache } from "@/misc/cache.js";
import { IsNull } from "typeorm";

const ACTOR_USERNAME = "instance.actor" as const;

const cache = new Cache<ILocalUser>(Infinity);

export async function getInstanceActor(): Promise<ILocalUser> {
	return await cache.fetch(null, async () => {
		const user = (await Users.findOneBy({
			host: IsNull(),
			username: ACTOR_USERNAME,
		})) as ILocalUser | undefined;

		if (user) {
			return user;
		}
		return (await createSystemUser(ACTOR_USERNAME)) as ILocalUser;
	});
}
