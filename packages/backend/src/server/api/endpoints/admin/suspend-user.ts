/**
 * @packageDocumentation
 *
 * 管理者が指定ユーザーをサスペンド（凍結）する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `admin/suspend-user`（POST `/api/admin/suspend-user` で呼び出し）
 * - 認証必須・モデレーター権限必須。userId で指定したユーザーをサスペンドし、Delete アクティビティ送信後に削除ジョブを投入する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import deleteFollowing from "@/services/following/delete.js";
import { Users, Followings, Notifications } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { doPostSuspend } from "@/services/suspend-user.js";
import { publishUserEvent } from "@/services/stream.js";
import pLimit from "p-limit";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:suspend-user",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error("user not found");
	}

	if (user.isAdmin) {
		throw new Error("cannot suspend admin");
	}

	if (user.isModerator) {
		throw new Error("cannot suspend moderator");
	}

	await Users.update(user.id, {
		isSuspended: true,
	});

	insertModerationLog(me, "suspend", {
		targetId: user.id,
	});

	// ストリーミングを終了する
	if (Users.isLocalUser(user)) {
		publishUserEvent(user.id, "terminate", {});
	}

	(async () => {
		await doPostSuspend(user).catch((e) => {});
		await unFollowAll(user).catch((e) => {});
		await readAllNotify(user).catch((e) => {});
	})();
});

async function unFollowAll(follower: User) {
        const followings = await Followings.findBy({
                followerId: follower.id,
        });

        const limit = pLimit(8);

        await Promise.all(
                followings.map((following) =>
                        limit(async () => {
                                const followee = await Users.findOneBy({
                                        id: following.followeeId,
                                });

                                if (followee == null) {
                                        throw new Error(
                                                `Cant find followee ${following.followeeId}`,
                                        );
                                }

                                await deleteFollowing(follower, followee, true);
                        }),
                ),
        );
}

async function readAllNotify(notifier: User) {
	await Notifications.update(
		{
			notifierId: notifier.id,
			isRead: false,
		},
		{
			isRead: true,
		},
	);
}
