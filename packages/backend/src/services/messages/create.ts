import type { CacheableUser, User } from "@/models/entities/user.js";
import type { UserGroup } from "@/models/entities/user-group.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import {
	MessagingMessages,
	UserGroupJoinings,
	Mutings,
	Users,
} from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import type { MessagingMessage } from "@/models/entities/messaging-message.js";
import {
	publishMessagingStream,
	publishMessagingIndexStream,
	publishMainStream,
	publishGroupMessagingStream,
} from "@/services/stream.js";
import { pushNotification } from "@/services/push-notification.js";
import { Not } from "typeorm";
import type { Note } from "@/models/entities/note.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import renderCreate from "@/remote/activitypub/renderer/create.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { deliver } from "@/queue/index.js";
import { webhookDeliver } from "@/queue/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";

export async function createMessage(
	user: { id: User["id"]; host: User["host"] },
	recipientUser: CacheableUser | undefined,
	recipientGroup: UserGroup | undefined,
	text: string | null | undefined,
	file: DriveFile | null,
	uri?: string,
) {
	const message = {
		id: genId(),
		createdAt: new Date(),
		fileId: file ? file.id : null,
		recipientId: recipientUser ? recipientUser.id : null,
		groupId: recipientGroup ? recipientGroup.id : null,
		text: text ? text.trim() : null,
		userId: user.id,
		isRead: false,
		reads: [] as any[],
		uri,
	} as MessagingMessage;

	await MessagingMessages.insert(message);

	const messageObj = await MessagingMessages.pack(message);

	if (recipientUser) {
		if (Users.isLocalUser(user)) {
			// 自分のストリーム
			publishMessagingStream(
				message.userId,
				recipientUser.id,
				"message",
				messageObj,
			);
			publishMessagingIndexStream(message.userId, "message", messageObj);
			publishMainStream(message.userId, "messagingMessage", messageObj);
		}

		if (Users.isLocalUser(recipientUser)) {
			// 相手のストリーム
			publishMessagingStream(
				recipientUser.id,
				message.userId,
				"message",
				messageObj,
			);
			publishMessagingIndexStream(recipientUser.id, "message", messageObj);
			publishMainStream(recipientUser.id, "messagingMessage", messageObj);
		}
	} else if (recipientGroup) {
		// グループのストリーム
		publishGroupMessagingStream(recipientGroup.id, "message", messageObj);

		// メンバーのストリーム
		const joinings = await UserGroupJoinings.findBy({
			userGroupId: recipientGroup.id,
		});
		for (const joining of joinings) {
			publishMessagingIndexStream(joining.userId, "message", messageObj);
			publishMainStream(joining.userId, "messagingMessage", messageObj);
		}
	}

	// 3秒経っても(今回作成した)メッセージが既読にならなかったら「未読のメッセージがありますよ」イベントを発行する
	setTimeout(async () => {
		const freshMessage = await MessagingMessages.findOneBy({ id: message.id });
		if (freshMessage == null) return; // メッセージが削除されている場合もある

		if (recipientUser && Users.isLocalUser(recipientUser)) {
			if (freshMessage.isRead) return; // 既読

			//#region ただしミュートされているなら発行しない
			const mute = await Mutings.findBy({
				muterId: recipientUser.id,
			});
			if (mute.map((m) => m.muteeId).includes(user.id)) return;
			//#endregion

			publishMainStream(recipientUser.id, "unreadMessagingMessage", messageObj);
			pushNotification(recipientUser.id, "unreadMessagingMessage", messageObj);

			//webhook
			const webhooks = await getActiveWebhooks().then((webhooks) =>
				webhooks.filter(
					(x) => x.userId === recipientUser.id && x.on.includes("userMessage"),
				),
			);

			for (const webhook of webhooks) {
				webhookDeliver(webhook, "userMessage", {
					message: messageObj,
				});
			}
		} else if (recipientGroup) {
			const joinings = await UserGroupJoinings.findBy({
				userGroupId: recipientGroup.id,
				userId: Not(user.id),
			});
			for (const joining of joinings) {
				if (freshMessage.reads.includes(joining.userId)) return; // 既読
				publishMainStream(joining.userId, "unreadMessagingMessage", messageObj);
				pushNotification(joining.userId, "unreadMessagingMessage", messageObj);

				const targetUser = await Users.findOneByOrFail({ id: joining.userId });
				//webhook
				const webhooks = await getActiveWebhooks().then((webhooks) =>
					webhooks.filter(
						(x) =>
							x.userId === joining.userId &&
							x.on.includes("groupMessage") &&
							(!x.on.includes("groupMentionOnly") ||
								messageObj.text?.includes(`@${targetUser.username}`)),
					),
				);

				for (const webhook of webhooks) {
					webhookDeliver(webhook, "groupMessage", {
						message: messageObj,
					});
				}
			}
		}
	}, 3000);

	if (
		recipientUser &&
		Users.isLocalUser(user) &&
		Users.isRemoteUser(recipientUser)
	) {
		const note = {
			id: message.id,
			createdAt: message.createdAt,
			fileIds: message.fileId ? [message.fileId] : [],
			text: message.text,
			userId: message.userId,
			visibility: "specified",
			mentions: [recipientUser].map((u) => u.id),
			mentionedRemoteUsers: JSON.stringify(
				[recipientUser].map((u) => ({
					uri: u.uri,
					username: u.username,
					host: u.host,
				})),
			),
		} as Note;

		const activity = renderActivity(
			renderCreate(await renderNote(note, false, true), note),
		);

		deliver(user, activity, recipientUser.inbox);
	}
	return messageObj;
}
