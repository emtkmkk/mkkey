/**
 * @packageDocumentation
 *
 * ActivityPub の Move アクティビティを処理する。アカウント移転に伴いフォローを新アカウントへ引き継ぐ。
 *
 * @remarks
 * - **役割**: inbox で Move を受信した際に、フォロー関係を新アカウントへ移行する。
 *
 * @see {@link services/following/create} フォロー作成
 * @internal
 */
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { Followings, Users } from "@/models/index.js";
import {
	resolvePerson,
	updatePerson,
} from "@/remote/activitypub/models/person.js";
import create from "@/services/following/create.js";
import deleteFollowing from "@/services/following/delete.js";

import type { IMove } from "../../type.js";
import { getApHrefNullable } from "../../type.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IMove,
): Promise<string> => {
	// ※ activity.object にはブロック対象があり、存在するローカルユーザーである必要がある

	// 新アカウントと旧アカウントを取得
	const targetUri = getApHrefNullable(activity.target);
	if (!targetUri) return "move: target uri is null";
	let new_acc = await resolvePerson(targetUri);
	if (!actor.uri) return "move: actor uri is null";
	let old_acc = await resolvePerson(actor.uri);

	// リモートの場合は更新する
	if (new_acc.uri) await updatePerson(new_acc.uri);
	if (old_acc.uri) await updatePerson(old_acc.uri);

	// 更新後のユーザーを再取得
	new_acc = await resolvePerson(targetUri);
	old_acc = await resolvePerson(actor.uri);

	// 新アカウントの alsoKnownAs が妥当か確認
	let isValidMove = true;
	if (old_acc.uri) {
		if (!new_acc.alsoKnownAs?.includes(old_acc.uri)) {
			isValidMove = false;
		}
	} else if (!new_acc.alsoKnownAs?.includes(old_acc.id)) {
		isValidMove = false;
	}
	if (!isValidMove) {
		return "skip: accounts invalid";
	}

	// ユーザーが移転したことを示すため movedToUri にターゲット URI を設定
	await Users.update(old_acc.id, { movedToUri: targetUri });

	// 新アカウントをフォローし、旧アカウントのフォローを解除
	const followings = await Followings.findBy({
		followeeId: old_acc.id,
	});
	followings.forEach(async (following) => {
		// フォロワーがローカルの場合
		if (!following.followerHost) {
			try {
				const follower = await Users.findOneBy({ id: following.followerId });
				if (!follower) return;
				await create(follower, new_acc);
				await deleteFollowing(follower, old_acc);
			} catch {
				/* empty */
			}
		}
	});

	return "ok";
};
