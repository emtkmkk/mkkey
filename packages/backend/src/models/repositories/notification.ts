/**
 * @packageDocumentation
 *
 * 通知リポジトリ（pack / packMany）
 *
 * @remarks
 * - **役割**: 通知の pack/packMany と一覧取得を提供し、API の通知一覧・既読で利用する。
 * - `followedAccountWasDeleted` は `customBody` の表示名スナップショットで `user.name` を上書きする。
 *
 * @see {@link models/entities/notification} 通知エンティティ
 * @internal
 */
import { In } from "typeorm";
import { Notification } from "@/models/entities/notification.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import type { Note } from "@/models/entities/note.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import type { User } from "@/models/entities/user.js";
import { aggregateNoteEmojis, prefetchEmojis } from "@/misc/populate-emojis.js";
import { notificationTypes } from "@/types.js";
import { db } from "@/db/postgre.js";
import Logger from "@/services/logger.js";
import { hasMuteScope } from "@/misc/mute-scope.js";

const notificationPackLogger = new Logger("notification-pack");
import {
	Users,
	Notes,
	UserGroupInvitations,
	AccessTokens,
	NoteReactions,
	Antennas,
	Mutings,
} from "../index.js";

export const NotificationRepository = db.getRepository(Notification).extend({
	async pack(
		src: Notification["id"] | Notification,
		options: {
			_hintForEachNotes_?: {
				myReactions: Map<Note["id"], NoteReaction | null>;
			};
			_followBlockingMap_?: Map<User["id"], Set<User["id"]>>;
			/** まとめ読み用: notifier の User（avatar/banner 付き）を id → 実体で渡す。渡すと drive_file の個別参照を避ける */
			_notifierUserMap_?: Map<User["id"], User>;
		} = {},
	): Promise<Packed<"Notification"> | null> {
		const notification =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });
		const token = notification.appAccessTokenId
			? await AccessTokens.findOneByOrFail({
					id: notification.appAccessTokenId,
			  })
			: null;

		if (
			notification.type === "receiveFollowRequest" &&
			notification.notifierId
		) {
			let blockingSet = options._followBlockingMap_?.get(
				notification.notifieeId,
			);

			if (blockingSet == null) {
				const followBlocking = await Mutings.findBy({
					muterId: notification.notifieeId,
				});
				blockingSet = new Set(
					followBlocking
						.filter((muting) => hasMuteScope(muting.scope, "follow"))
						.map((muting) => muting.muteeId),
				);
			}

			if (blockingSet.has(notification.notifierId)) {
				return null;
			}
		}

		return await awaitAll({
			id: notification.id,
			createdAt: notification.createdAt.toISOString(),
			type: notification.type === "unreadAntenna" ? "note" : notification.type,
			isRead: notification.isRead,
			userId: notification.notifierId,
			customBody: notification.customBody || undefined,
			user: notification.notifierId
				? (async () => {
						const packed = await Users.pack(
							options._notifierUserMap_?.get(notification.notifierId) ??
									notification.notifier ??
									notification.notifierId!,
							{ id: notification.notifieeId },
						);
						// アカウント削除通知は customBody に保存した表示名で上書きする
						if (
							notification.type === "followedAccountWasDeleted" &&
							notification.customBody
						) {
							return { ...packed, name: notification.customBody };
						}
						return packed;
				  })()
				: null,
			...(notification.type === "mention"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
				  }
				: {}),
			...(notification.type === "reply"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
				  }
				: {}),
			...(notification.type === "renote"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
				  }
				: {}),
			...(notification.type === "quote"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
				  }
				: {}),
			...(notification.type === "reaction"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
						reaction: notification.reaction,
				  }
				: {}),
			...(notification.type === "unreadAntenna"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
						reaction: notification.reaction,
				  }
				: {}),
			...(notification.type === "pollVote"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
						choice: notification.choice,
				  }
				: {}),
			...(notification.type === "pollEnded"
				? {
						note: Notes.pack(
							notification.note || notification.noteId!,
							{ id: notification.notifieeId },
							{
								detail: true,
								_hint_: options._hintForEachNotes_,
							},
						),
				  }
				: {}),
			...(notification.type === "groupInvited"
				? {
						invitation: UserGroupInvitations.pack(
							notification.userGroupInvitationId!,
						),
				  }
				: {}),
			...(notification.type === "app"
				? {
						body: notification.customBody,
						header: notification.customHeader || token?.name,
						icon: notification.customIcon || token?.iconUrl,
						subIcon: notification.customSubIcon || undefined,
				  }
				: {}),
		});
	},

	async packMany(notifications: Notification[], meId: User["id"]) {
		if (notifications.length === 0) return [];

		const notifierIds = [
			...new Set(
				notifications
					.map((x) => x.notifierId)
					.filter((id): id is User["id"] => id != null),
			),
		];
		const notifierUserMap =
			notifierIds.length > 0
				? new Map(
						(
								await Users.find({
										where: { id: In(notifierIds) },
										relations: { avatar: true, banner: true },
								})
						).map((u) => [u.id, u] as const),
				  )
				: undefined;

		const notes = notifications
			.filter((x) => x.note != null)
			.map((x) => x.note!);
		const noteIds = notes.map((n) => n.id);
		const myReactionsMap = new Map<Note["id"], NoteReaction | null>();
		const renoteIds = notes
			.filter((n) => n.renoteId != null)
			.map((n) => n.renoteId!);
		const targets = [...noteIds, ...renoteIds];
		const myReactions = await NoteReactions.findBy({
			userId: meId,
			noteId: In(targets),
		});

		for (const target of targets) {
			myReactionsMap.set(
				target,
				myReactions.find((reaction) => reaction.noteId === target) || null,
			);
		}

		const followRequestNotifieeMap = new Map<User["id"], Set<User["id"]>>();

		for (const notification of notifications) {
			if (
					notification.type === "receiveFollowRequest" &&
					notification.notifierId
			) {
				if (!followRequestNotifieeMap.has(notification.notifieeId)) {
					followRequestNotifieeMap.set(
						notification.notifieeId,
						new Set<User["id"]>(),
					);
				}
				followRequestNotifieeMap
					.get(notification.notifieeId)!
					.add(notification.notifierId);
			}
		}

		const followBlockingMap = new Map<User["id"], Set<User["id"]>>();

		if (followRequestNotifieeMap.size > 0) {
			const blockerIds = [...followRequestNotifieeMap.keys()];
			const followBlockings = await Mutings.findBy({
				muterId: In(blockerIds),
			});

			for (const blockerId of blockerIds) {
				followBlockingMap.set(blockerId, new Set<User["id"]>());
			}

			for (const blocking of followBlockings) {
				if (!hasMuteScope(blocking.scope, "follow")) continue;

				let blockeeSet = followBlockingMap.get(blocking.muterId);

				if (blockeeSet == null) {
					blockeeSet = new Set<User["id"]>();
					followBlockingMap.set(blocking.muterId, blockeeSet);
				}

				blockeeSet.add(blocking.muteeId);
			}
		}

		await prefetchEmojis(aggregateNoteEmojis(notes));

		const results = await Promise.all(
			notifications.map((x) =>
				this.pack(x, {
					_hintForEachNotes_: {
						myReactions: myReactionsMap,
					},
					_followBlockingMap_:
						followBlockingMap.size > 0
							? followBlockingMap
							: undefined,
					_notifierUserMap_: notifierUserMap,
				}).catch((e) => {
					notificationPackLogger.warn("pack failed", {
						notificationId: x.id,
						error: e,
					});
					return null;
				}),
			),
		);
		return results.filter((x) => x != null);
	},
});
