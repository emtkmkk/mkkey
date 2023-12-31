import { publishUserListStream } from "@/services/stream.js";
import type { User } from "@/models/entities/user.js";
import type { UserList } from "@/models/entities/user-list.js";
import { UserListJoinings, Users, Followings } from "@/models/index.js";
import type { UserListJoining } from "@/models/entities/user-list-joining.js";
import { genId } from "@/misc/gen-id.js";
import { fetchProxyAccount } from "@/misc/fetch-proxy-account.js";
import createFollowing from "../following/create.js";

export async function pushUserToUserList(target: User, list: UserList) {
	await UserListJoinings.insert({
		id: genId(),
		createdAt: new Date(),
		userId: target.id,
		userListId: list.id,
	} as UserListJoining);

	publishUserListStream(list.id, "userAdded", await Users.pack(target));
	
	const localFollowersCount = await Followings.createQueryBuilder("following")
			.where("following.followeeId = :userId", { userId: target.id })
			.andWhere("following.followerHost IS NULL")
			.getCount();

	// このインスタンス内にこのリモートユーザーをフォローしているユーザーがいなくても投稿を受け取るためにダミーのユーザーがフォローしたということにする
	// 条件 : 対象のローカル内フォロワーが0人以下（ローカルからフォローされていない）
	if (Users.isRemoteUser(target) && localFollowersCount <= 0) {
		const proxy = await fetchProxyAccount();
		if (proxy) {
			createFollowing(proxy, target);
		}
	}
}
