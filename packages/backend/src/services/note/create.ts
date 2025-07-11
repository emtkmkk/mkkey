import * as mfm from "mfm-js";
import es from "../../db/elasticsearch.js";
import sonic from "../../db/sonic.js";
import {
	publishMainStream,
	publishNotesStream,
	publishNoteStream,
} from "@/services/stream.js";
import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import renderCreate from "@/remote/activitypub/renderer/create.js";
import renderAnnounce from "@/remote/activitypub/renderer/announce.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { resolveUser } from "@/remote/resolve-user.js";
import config from "@/config/index.js";
import { updateHashtags } from "../update-hashtag.js";
import { concat } from "@/prelude/array.js";
import { insertNoteUnread } from "@/services/note/unread.js";
import { registerOrFetchInstanceDoc } from "../register-or-fetch-instance-doc.js";
import { extractMentions } from "@/misc/extract-mentions.js";
import { extractCustomEmojisFromMfm } from "@/misc/extract-custom-emojis-from-mfm.js";
import { extractHashtags } from "@/misc/extract-hashtags.js";
import type { IMentionedRemoteUsers } from "@/models/entities/note.js";
import { Note } from "@/models/entities/note.js";
import {
	Mutings,
	Users,
	NoteWatchings,
	Notes,
	Instances,
	UserProfiles,
	Antennas,
	Followings,
	MutedNotes,
	Channels,
	ChannelFollowings,
	Blockings,
	NoteThreadMutings,
} from "@/models/index.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { App } from "@/models/entities/app.js";
import { Not, In, IsNull } from "typeorm";
import { User, ILocalUser, IRemoteUser } from "@/models/entities/user.js";
import { genId } from "@/misc/gen-id.js";
import {
	notesChart,
	perUserNotesChart,
	activeUsersChart,
	instanceChart,
} from "@/services/chart/index.js";
import type { IPoll } from "@/models/entities/poll.js";
import { Poll } from "@/models/entities/poll.js";
import { createNotification } from "../create-notification.js";
import { isDuplicateKeyValueError } from "@/misc/is-duplicate-key-value-error.js";
import { checkHitAntenna } from "@/misc/check-hit-antenna.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { addNoteToAntenna } from "../add-note-to-antenna.js";
import { countSameRenotes } from "@/misc/count-same-renotes.js";
import { deliverToRelays } from "../relay.js";
import { isIncludeNgWordIsNote } from "@/misc/is-include-ng-word.js";
import type { Channel } from "@/models/entities/channel.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { getAntennas } from "@/misc/antenna-cache.js";
import { endedPollNotificationQueue } from "@/queue/queues.js";
import { webhookDeliver } from "@/queue/index.js";
import { Cache } from "@/misc/cache.js";
import type { UserProfile } from "@/models/entities/user-profile.js";
import { db } from "@/db/postgre.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { shouldSilenceInstance } from "@/misc/should-block-instance.js";
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import renderTombstone from "@/remote/activitypub/renderer/tombstone.js";
import { fetchMeta } from "@/misc/fetch-meta.js";

const mutedWordsCache = new Cache<
	{ userId: UserProfile["userId"]; mutedWords: UserProfile["mutedWords"] }[]
>(1000 * 60 * 5);

type NotificationType = "reply" | "renote" | "quote" | "mention";

class NotificationManager {
	private notifier: { id: User["id"] };
	private note: Note;
	private queue: {
		target: ILocalUser["id"];
		reason: NotificationType;
	}[];

	constructor(notifier: { id: User["id"] }, note: Note) {
		this.notifier = notifier;
		this.note = note;
		this.queue = [];
	}

	public push(notifiee: ILocalUser["id"], reason: NotificationType) {
		// 自分自身へは通知しない
		if (this.notifier.id === notifiee) return;

		const exist = this.queue.find((x) => x.target === notifiee);

		if (exist) {
			// 「メンションされているかつ返信されている」場合は、メンションとしての通知ではなく返信としての通知にする
			if (reason !== "mention") {
				exist.reason = reason;
			}
		} else {
			this.queue.push({
				reason: reason,
				target: notifiee,
			});
		}
	}

	public async deliver() {
		for (const x of this.queue) {
			// ミュート情報を取得
			const mentioneeMutes = await Mutings.findBy({
				muterId: x.target,
			});

			const mentioneesMutedUserIds = mentioneeMutes.map((m) => m.muteeId);

			// 通知される側のユーザーが通知する側のユーザーをミュートしていない限りは通知する
			if (!mentioneesMutedUserIds.includes(this.notifier.id)) {
				createNotification(x.target, x.reason, {
					notifierId: this.notifier.id,
					noteId: this.note.id,
					note: this.note,
				});
			}
		}
	}
}

type MinimumUser = {
	id: User["id"];
	host: User["host"];
	username: User["username"];
	uri: User["uri"];
	isBot: User["isBot"];
};

type Option = {
	createdAt?: Date | null;
	name?: string | null;
	text?: string | null;
	reply?: Note | null;
	renote?: Note | null;
	references?: string[] | null;
	files?: DriveFile[] | null;
	poll?: IPoll | null;
	localOnly?: boolean | null;
	cw?: string | null;
	visibility?: string;
	visibilityForce?: boolean | null;
	visibleUsers?: MinimumUser[] | null;
	ccUsers?: MinimumUser[] | null;
	channel?: Channel | null;
	apMentions?: MinimumUser[] | null;
	apHashtags?: string[] | null;
	apEmojis?: string[] | null;
	uri?: string | null;
	url?: string | null;
	app?: App | null;
	isPublicLikeList?: boolean | null;
	isFirstNote?: boolean | null;
};

export default async (
	user: {
		id: User["id"];
		username: User["username"];
		name: User["name"];
		host: User["host"];
		isSilenced: User["isSilenced"];
		createdAt: User["createdAt"];
		emojis: User["emojis"];
		isAdmin: User["isAdmin"];
		isModerator: User["isModerator"];
		isBot: User["isBot"];
		avatarId: User["avatarId"];
		canInvite: User["canInvite"];
		notesCount: User["notesCount"];
		onlineStatus: User["onlineStatus"];
		maxRankPoint: User["maxRankPoint"];
		isPublicLikeList: User["isPublicLikeList"];
		blockPostPublic: User["blockPostPublic"];
		blockPostHome: User["blockPostHome"];
		blockPostNotLocal: User["blockPostNotLocal"];
		blockPostNotLocalPublic: User["blockPostNotLocalPublic"];
	},
	data: Option,
	silent = false,
) =>
	// rome-ignore lint/suspicious/noAsyncPromiseExecutor: FIXME
	new Promise<Note>(async (res, rej) => {
		// 最初に投稿時刻を確定させる
		if (data.createdAt == null) data.createdAt = new Date();

		const firstVisibility = data.visibility ?? "public";

		const dontFederateInitially =
			(data.localOnly && data.channel) || data.visibility === "hidden";

		// If you reply outside the channel, match the scope of the target.
		// TODO (I think it's a process that could be done on the client side, but it's server side for now.)
		if (
			data.reply &&
			data.channel &&
			data.reply.channelId !== data.channel.id
		) {
			if (data.reply.channelId) {
				data.channel = await Channels.findOneBy({ id: data.reply.channelId });
			} else {
				data.channel = null;
			}
		}
		if (
			data.renote &&
			data.channel &&
			data.renote.channelId !== data.channel.id
		) {
			if (data.renote.channelId) {
				data.channel = await Channels.findOneBy({ id: data.renote.channelId });
			} else {
				data.channel = null;
			}
		}

		// When you reply in a channel, match the scope of the target
		// TODO (I think it's a process that could be done on the client side, but it's server side for now.)
		if (data.reply && data.channel == null && data.reply.channelId) {
			data.channel = await Channels.findOneBy({ id: data.reply.channelId });
		}
		if (data.renote && data.channel == null && data.renote.channelId) {
			data.channel = await Channels.findOneBy({ id: data.renote.channelId });
		}

		//リモートのノートはチャンネル扱いにしない
		if (user.host && data.channel) data.channel = null;

		//指定がなければpublicでlocalOnlyOFF
		if (data.visibility == null) data.visibility = "public";
		if (data.localOnly == null) data.localOnly = false;
               if (!data.visibilityForce && data.visibility !== "specified") {
			//チャンネル投稿でリプライ、リノートでないならpublic
			if (data.channel != null && !data.reply && !data.renote)
				data.visibility = "public";
			//publicをブロックする設定でpublic設定ならhomeに設定
			if (user.blockPostPublic && data.visibility === "public")
				data.visibility = "home";
			//homeをブロックする設定でhome設定ならfollowersに設定
			if (user.blockPostHome && data.visibility === "home")
				data.visibility = "followers";
			//非localOnlyをブロックする設定で非localOnly設定ならlocalOnlyに設定
			if (
				user.blockPostNotLocal &&
				data.localOnly === false &&
				(!user.blockPostNotLocalPublic || data.visibility === "public")
			)
				data.localOnly = true;
			if (data.visibility === "hidden") data.visibility = "public";
			//LTLが無効ならホームに
			if (!user.host && data.channel == null && data.visibility === "public") {
				const m = await fetchMeta();
				if (m.disableLocalTimeline) {
					data.visibility = "home";
				}
			}
		}
		//ただしspecifiedならlocalOnlyOFF
		if (data.visibility === "specified" && data.localOnly === true)
			data.localOnly = false;
		//チャンネルに[localOnly]が含まれている場合はlocalOnlyON
		if (
			data.channel?.description?.includes("[localOnly]") &&
			data.localOnly === false
		)
			data.localOnly = true;
		if (
			!user.host &&
			data.channel != null &&
			data.localOnly === false &&
			!data.reply &&
			data.text?.trim() &&
			!data.text?.includes(`#${data.channel!.name}`)
		) {
			//ローカル投稿でチャンネルで連合有りで返信でなくテキストがあり、
			//すでにタグが含まれていない場合はハッシュタグを自動で付ける
			data.text += ` #${data.channel!.name}`;
		}

		// Twitterのstatusリンクの場合、?以降を取り除く
		if (
			data.text?.includes("https://twitter.com") ||
			data.text?.includes("http://twitter.com")
		) {
			data.text = data.text.replaceAll(
				/(https?:\/\/twitter.com\/\S*\/status\/\S*)(\?[^\s\)]*)/gi,
				"$1",
			);
		}

		if (
			data.text?.includes("https://x.com") ||
			data.text?.includes("http://x.com")
		) {
			data.text = data.text.replaceAll(
				/(https?:\/\/x.com\/\S*\/status\/\S*)(\?[^\s\)]*)/gi,
				"$1",
			);
		}

		//ローカルユーザーでこの投稿が1投稿目の場合
		if (!user.host && user.notesCount < 1) {
			//キャッシュで0に見えてる可能性があるためここで最新データを取得
			const _user = await Users.findOneByOrFail({ id: user.id });
			if (_user.notesCount === 0) {
				data.isFirstNote = true;
			}
		}

		//23:59の間によるほを含む投稿をした場合
		if (
			data.createdAt?.getHours() === 23 &&
			data.createdAt?.getMinutes() === 59 &&
			!user.host &&
			(data.text?.includes("よるほ") ||
				data.text?.includes("ヨルホ") ||
				data.text?.includes("yoruho"))
		) {
			if (
				data.createdAt?.getSeconds() === 59 &&
				data.createdAt?.getMilliseconds() !== 0
			) {
				//誤差がミリ秒単位の場合
				data.text = `${data.text} [❌ -.${(
					1000 - data.createdAt.getMilliseconds()
				)
					.toString()
					.padStart(3, "0")}]`;
			} else {
				data.text = `${data.text} [❌ -${(
					60 - data.createdAt?.getSeconds()
				).toString()}s]`;
			}
		}

		//0:00の間によるほを含む投稿をした場合
		if (
			data.createdAt?.getHours() === 0 &&
			data.createdAt?.getMinutes() === 0 &&
			!user.host &&
			(data.text?.includes("よるほ") ||
				data.text?.includes("ヨルホ") ||
				data.text?.includes("yoruho"))
		) {
			if (data.createdAt?.getMilliseconds() === 0) {
				//ジャストの場合
				data.text = `${data.text} [\$[tada 🦉 .000]]`;
			} else if (data.createdAt?.getSeconds() === 0) {
				//誤差がミリ秒単位の場合
				data.text = `${data.text} [🦉 .${data.createdAt
					.getMilliseconds()
					.toString()
					.padStart(3, "0")}]`;
			} else {
				data.text = `${data.text} [❌ +${data.createdAt
					?.getSeconds()
					.toString()}s]`;
			}
		}

		// サイレンスされている場合はフォロワー限定に
		if (user.isSilenced && data.visibility !== "specified") {
			data.visibility = "followers";
			data.localOnly = true;
		}

		// Enforce home visibility if the user is in a silenced instance.
		if (
			data.visibility === "public" &&
			Users.isRemoteUser(user) &&
			(await shouldSilenceInstance(user.host))
		) {
			data.visibility = "home";
		}

		if (data.reply?.deletedAt) {
			if (data.reply?.userHost == null && user.host != null) {
				const content = renderActivity(
					renderDelete(
						renderTombstone(`${config.url}/notes/${data.reply?.id}`),
						{ id: data.reply.userId, host: data.reply.userHost },
					),
				);
				const dm = new DeliverManager(
					{ id: data.reply.userId, host: data.reply.userHost },
					content,
				);
				const u = await Users.findOneBy({ id: user.id });
				if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
				dm.execute();
				return rej(
					"削除された投稿に対して返信されました。削除リクエストを送信しました。",
				);
			} else {
				return rej("削除された投稿に対しては返信できません。");
			}
		}

		if (data.renote?.deletedAt) {
			if (data.renote?.userHost == null && user.host != null) {
				const content = renderActivity(
					renderDelete(
						renderTombstone(`${config.url}/notes/${data.renote?.id}`),
						{ id: data.renote.userId, host: data.renote.userHost },
					),
				);
				const dm = new DeliverManager(
					{ id: data.renote.userId, host: data.renote.userHost },
					content,
				);
				const u = await Users.findOneBy({ id: user.id });
				if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
				dm.execute();
				return rej(
					"削除された投稿がRTされました。削除リクエストを送信しました。",
				);
			} else {
				return rej("削除された投稿はRTできません。");
			}
		}

		// Reject if the target of the renote is a public range other than "Home or Entire".
		if (
			data.renote &&
			data.renote.visibility !== "public" &&
			data.renote.visibility !== "home" &&
			data.renote.userId !== user.id
		) {
			return rej("Renote target is not public or home");
		}

               if (!data.visibilityForce && data.visibility !== "specified") {
                        // If the target of the renote is not public, make it home.
                        if (
                                data.renote &&
                                data.renote.visibility !== "public" &&
                                data.visibility === "public"
                        ) {
                                data.visibility = "home";
                        }

                        // If the target of Renote is followers, make it followers.
                        if (data.renote && data.renote.visibility === "followers") {
                                data.visibility = "followers";
                        }

		// If the reply target is not public, make it home.
		if (
			data.reply &&
			data.reply.visibility !== "public" &&
			data.visibility === "public"
		) {
			data.visibility = "home";
		}

		// If the reply target is followers, make it followers.
		if (
			data.reply &&
			data.reply.visibility === "followers" &&
			(data.visibility === "public" || data.visibility === "home")
		) {
			data.visibility = "followers";
		}

		// If the reply target is specified, make it specified.
		if (
			data.reply &&
			data.reply.visibility === "specified" &&
			data.visibility !== "specified"
		) {
			data.visibility = "specified";
		}

		// Renote local only if you Renote local only.
		if (data.renote?.localOnly) {
			data.localOnly = true;
		}

		// If you reply to local only, make it local only.
		if (data.reply?.localOnly) {
			data.localOnly = true;
		}

		}

		if (data.text) {
			data.text = data.text.trim();
		} else {
			data.text = null;
		}

		if (
			!user.host &&
			data.renote &&
			user.maxRankPoint < 1200 &&
			!user.canInvite &&
			data.visibility === "public" &&
			data.renote.userHost != null
		) {
			data.visibility = "home";
		}

		if (
			!user.host &&
			user.maxRankPoint < 1200 &&
			!user.canInvite &&
			data.reply?.userHost == null &&
			/^(@\w+\s*)?:[\w@._\-]:$/.test(data.text ?? "")
		) {
			return rej(
				"この内容の返信は現在制限されています。絵文字だけの返信なら、リアクション機能を使用してみませんか？",
			);
		}

		if (
			!user.host &&
			(data.visibility === "public" || data.cw?.trim().toUpperCase() === "CW")
		) {
			const isIncludeNgWordRet = isIncludeNgWordIsNote(data);

			if (isIncludeNgWordRet) {
				if (isIncludeNgWordRet === "NG") {
					if (user.maxRankPoint < 1200 && !user.canInvite)
						data.visibility = "home";
				} else if (!data.cw) {
					if (user.isBot) {
						data.cw = `[強制CW] ${isIncludeNgWordRet}`;
					} else {
						return rej("CW無しで投稿できないワードが本文に含まれています。");
					}
				} else if (!data.cw.trim() || data.cw.trim().toUpperCase() === "CW") {
					data.cw = isIncludeNgWordRet;
				} else if (
					!(
						data.cw?.includes(isIncludeNgWordRet?.replace("(弱)", "")) ||
						data.cw?.includes(
							kana_to_hira(isIncludeNgWordRet?.replace("(弱)", "")),
						) ||
						data.cw?.includes("(弱)") ||
						!isIncludeNgWordRet?.includes("(弱)")
					)
				) {
					data.cw += ` (${isIncludeNgWordRet})`;
				}
			}

			if (data.renote) {
				const isIncludeNgWordRtRet = isIncludeNgWordIsNote(data.renote);
				if (isIncludeNgWordRtRet) {
					if (isIncludeNgWordRtRet === "NG") {
						if (user.maxRankPoint < 1200) data.visibility = "home";
					} else if (data.text) {
						if (!data.cw) {
							data.cw = `[強制CW (引用先)] ${isIncludeNgWordRtRet}`;
						} else if (
							!data.cw.trim() ||
							data.cw.trim().toUpperCase() === "CW"
						) {
							data.cw = `${isIncludeNgWordRtRet} (引用先)`;
						} else if (
							!(
								data.cw?.includes(isIncludeNgWordRet?.replace("(弱)", "")) ||
								data.cw?.includes(
									kana_to_hira(isIncludeNgWordRet?.replace("(弱)", "")),
								) ||
								data.cw?.includes("(弱)") ||
								!isIncludeNgWordRet?.includes("(弱)")
							)
						) {
							data.cw += ` (${isIncludeNgWordRet} (引用先))`;
						}
					} else {
						data.visibility = "home";
					}
				}
			}
		}

		let tags = data.apHashtags;
		let emojis = data.apEmojis;
		let mentionedUsers = data.apMentions;

		// Parse MFM if needed
		if (!(tags && emojis && mentionedUsers)) {
			const tokens = data.text ? mfm.parse(data.text)! : [];
			const cwTokens = data.cw ? mfm.parse(data.cw)! : [];
			const choiceTokens = data.poll?.choices
				? concat(data.poll.choices.map((choice) => mfm.parse(choice)!))
				: [];

			const combinedTokens = tokens.concat(cwTokens).concat(choiceTokens);

			tags = data.apHashtags || extractHashtags(combinedTokens);

			emojis = data.apEmojis || extractCustomEmojisFromMfm(combinedTokens);

			mentionedUsers =
				data.apMentions || (await extractMentionedUsers(user, combinedTokens));
		}

		tags = tags
			.filter((tag) => Array.from(tag || "").length <= 128)
			.splice(0, 32);

		//スパム対策
		if (
			user.host &&
			["public", "home"].includes(data.visibility) &&
			user.notesCount < 500 &&
			mentionedUsers?.length > 2
		) {
			console.log(`mentionedUsers.length: ${mentionedUsers?.length}`);
			if (
				tags?.some(
					(x) =>
						x.includes("黒猫サーバー") ||
						x.includes("kuroneko6423") ||
						x.includes("伊藤陽久"),
				)
			)
				return rej("禁止タグが含まれています。");
			/*
			if (
				mentionedUsers?.length > 3 &&
				data.text?.includes("https://discord.gg/")
			)
				return rej("禁止投稿です。(discordへの誘導)");
			if (
				mentionedUsers?.length > 7 &&
				(data.text?.includes("ap12") || data.text?.includes("猫"))
			)
				return rej("禁止投稿です。(メンション多すぎ)");
			console.log(
				`maintext: ${
					data.text
						?.replaceAll(/[\s\\n]*@\w+(@[\-._\w]+)?[\s\\n]{0,}/gi, "")
						.trim()?.length
				}`,
			);
			if (
				mentionedUsers?.length > 2 &&
				mentionedUsers.filter((x) => !x.host || x.host === config.host).length >
					0 &&
				mentionedUsers.filter((x) => !x.host || x.host === config.host).length -
					mentionedUsers?.length <=
					-2 &&
				!data.reply
			) {
				const localRelation = await mentionedUsers
					.filter((x) => !x.host || x.host === config.host)
					.every(
						async (x) => !(await Users.getRelation(user.id, x.id)).isFollowed,
					);
				console.log(`localRelation: ${!localRelation}`);
				if (localRelation) return rej("禁止投稿です。(スパムの可能性が高い)");
			}
		*/
		}
		if (
			user.host &&
			["public", "home"].includes(data.visibility) &&
			user.notesCount < 5000 &&
			mentionedUsers.filter((x) => !x.host || x.host === config.host).length >
				0 &&
			Date.now() - new Date(user.createdAt).valueOf() <
				2 * 24 * 60 * 60 * 1000 &&
			(!user.name || user.name === user.username) &&
			!user.emojis?.length &&
			(!user.avatarId || user.avatarUrl?.includes("identicon"))
		) {
			const localRelation = await mentionedUsers
				.filter((x) => !x.host || x.host === config.host)
				.every(
					async (x) => !(await Users.getRelation(user.id, x.id)).isFollowed,
				);
			console.log(`localRelation: ${!localRelation}`);
			if (localRelation) return rej("禁止投稿です。(怪しいプロフィール)");
		}

		if (user.host && ["public", "home"].includes(data.visibility) && config.specialServerHosts?.includes(user.host) &&
			mentionedUsers.filter((x) => !x.host || x.host === config.host).length == 0 && Math.random() < 0.1) {
			return rej("スパムの可能性あり");
		}
	
		if (
			data.reply &&
			user.id !== data.reply.userId &&
			!mentionedUsers.some((u) => u.id === data.reply!.userId)
		) {
			mentionedUsers.push(
				await Users.findOneByOrFail({ id: data.reply!.userId }),
			);
		}

		if (data.visibility === "specified") {
			if (data.visibleUsers == null) throw new Error("invalid param");

			for (const u of data.visibleUsers) {
				if (!mentionedUsers.some((x) => x.id === u.id)) {
					mentionedUsers.push(u);
				}
			}

			if (
				data.reply &&
				!data.visibleUsers.some((x) => x.id === data.reply!.userId)
			) {
				data.visibleUsers.push(
					await Users.findOneByOrFail({ id: data.reply!.userId }),
				);
			}

			const relation = user.isSilenced
				? await Promise.all(
						data.visibleUsers.map(
							async (x) => (await Users.getRelation(user.id, x.id)).isFollowed || (await Users.findOneByOrFail({ id: x.id })).isAdmin,
						),
				  )
				: undefined;
	
			if (user.isSilenced && (!relation?.every((x) => x) ?? true)) {
				return rej(
					"サイレンス中はフォロワーでも管理人でもないユーザにダイレクトは送信できません。",
				);
			}
		}

		data.isPublicLikeList = user.isPublicLikeList;

		const note = await insertNote(user, data, tags, emojis, mentionedUsers);
		
		if (firstVisibility != note.visibility) console.log(`${note.id}:可視性変更 ${firstVisibility} -> ${note.visibility}`);

		res(note);

		// 統計を更新
		notesChart.update(note, true, user.isBot);
		if (data.visibility !== "specified") {
			perUserNotesChart.update(user, note, true, user.isBot);
		}

		// Register host
		if (Users.isRemoteUser(user)) {
			registerOrFetchInstanceDoc(user.host).then((i) => {
				Instances.increment({ id: i.id }, "notesCount", 1);
				instanceChart.updateNote(i.host, note, true);
			});
		}

		// ハッシュタグ更新
		if (data.visibility === "public" || data.visibility === "home") {
			updateHashtags(user, tags);
		}

		// Increment notes count (user)
		if (data.visibility !== "specified") incNotesCountOfUser(user);

		// リモートユーザまたはbotの投稿時、ユーザの最終更新時刻を更新
		// 2時間前以上の場合は更新しない
		// TODO : 更新した時に時刻が戻る可能性あり
		if (
			(user.onlineStatus === "online" ||
				user.onlineStatus === "half-online" ||
				Users.isRemoteUser(user) ||
				user.isBot) &&
			new Date().valueOf() - data.createdAt.valueOf() < 2 * 60 * 60 * 1000
		) {
			Users.update(user.id, {
				lastActiveDate: data.createdAt,
			});
		}

		// Word mute
		mutedWordsCache
			.fetch(null, () =>
				UserProfiles.find({
					where: {
						enableWordMute: true,
					},
					select: ["userId", "mutedWords"],
				}),
			)
			.then((us) => {
				for (const u of us) {
					getWordHardMute(data, { id: u.userId }, u.mutedWords).then(
						(shouldMute) => {
							if (shouldMute) {
								MutedNotes.insert({
									id: genId(),
									userId: u.userId,
									noteId: note.id,
									reason: "word",
								});
							}
						},
					);
				}
			});

		// Antenna
		for (const antenna of await getAntennas()) {
			checkHitAntenna(antenna, note, user).then((hit) => {
				if (hit) {
					addNoteToAntenna(antenna, note, user);
				}
			});
		}

		// Channel
		if (note.channelId) {
			ChannelFollowings.findBy({ followeeId: note.channelId }).then(
				(followings) => {
					for (const following of followings) {
						insertNoteUnread(following.followerId, note, {
							isSpecified: false,
							isMentioned: false,
						});
					}
				},
			);
		}

		if (data.reply) {
			saveReply(data.reply, note);
		}

		// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
		if (
			data.renote &&
			!user.isBot &&
			(await countSameRenotes(user.id, data.renote.id, note.id)) === 0
		) {
			incRenoteCount(data.renote, user.host);
		}

		if (data.poll?.expiresAt) {
			const delay = data.poll.expiresAt.getTime() - Date.now();
			endedPollNotificationQueue.add(
				{
					noteId: note.id,
				},
				{
					delay,
					removeOnComplete: true,
				},
			);
		}

		if (!silent) {
			if (Users.isLocalUser(user)) activeUsersChart.write(user);

			// 未読通知を作成
			if (data.visibility === "specified") {
				if (data.visibleUsers == null) throw new Error("invalid param");

				for (const u of data.visibleUsers) {
					// ローカルユーザーのみ
					if (!Users.isLocalUser(u)) continue;

					insertNoteUnread(u.id, note, {
						isSpecified: true,
						isMentioned: false,
					});
				}
			} else {
				for (const u of mentionedUsers) {
					// ローカルユーザーのみ
					if (!Users.isLocalUser(u)) continue;

					insertNoteUnread(u.id, note, {
						isSpecified: false,
						isMentioned: true,
					});
				}
			}

			if (data.visibility !== "hidden") {
				publishNotesStream(note);
			}
			if (note.replyId != null) {
				// Only provide the reply note id here as the recipient may not be authorized to see the note.
				publishNoteStream(note.replyId, "replied", {
					id: note.id,
				});
			}

			const webhooks = await getActiveWebhooks().then((webhooks) =>
				webhooks.filter((x) => x.userId === user.id && x.on.includes("note")),
			);

			for (const webhook of webhooks) {
				webhookDeliver(webhook, "note", {
					note: await Notes.pack(note, user),
				});
			}

			const nm = new NotificationManager(user, note);
			const nmRelatedPromises = [];

			await createMentionedEvents(mentionedUsers, note, nm);

			// If has in reply to note
			if (data.reply) {
				// Fetch watchers
				nmRelatedPromises.push(notifyToWatchersOfReplyee(data.reply, user, nm));

				// 通知
				if (data.reply.userHost === null) {
					const threadMuted = await NoteThreadMutings.findOneBy({
						userId: data.reply.userId,
						threadId: data.reply.threadId || data.reply.id,
					});

					if (!threadMuted) {
						nm.push(data.reply.userId, "reply");

						const packedReply = await Notes.pack(note, {
							id: data.reply.userId,
						});
						publishMainStream(data.reply.userId, "reply", packedReply);

						const webhooks = (await getActiveWebhooks()).filter(
							(x) => x.userId === data.reply!.userId && x.on.includes("reply"),
						);
						for (const webhook of webhooks) {
							webhookDeliver(webhook, "reply", {
								note: packedReply,
							});
						}
					}
				}
			}

			// If it is renote
			if (data.renote) {
				const isRenote = !(data.text || data.files?.length || data.poll);

				const type = !isRenote ? "quote" : "renote";

				// Notify
				if (data.renote.userHost === null) {
					const threadMuted = await NoteThreadMutings.findOneBy({
						userId: data.renote.userId,
						threadId: data.renote.threadId || data.renote.id,
					});

					if (!threadMuted) {
						nm.push(data.renote.userId, type);
					}
				}

				// Fetch watchers
				nmRelatedPromises.push(
					notifyToWatchersOfRenotee(data.renote, user, nm, type),
				);

				// Publish event
				if (user.id !== data.renote.userId && data.renote.userHost === null) {
					const packedRenote = await Notes.pack(note, {
						id: data.renote.userId,
					});
					publishMainStream(data.renote.userId, "renote", packedRenote);

					const webhooks = (await getActiveWebhooks()).filter(
						(x) => x.userId === data.renote!.userId && x.on.includes("renote"),
					);
					for (const webhook of webhooks) {
						webhookDeliver(webhook, "renote", {
							note: packedRenote,
						});
					}
				}
			}

			Promise.all(nmRelatedPromises).then(() => {
				nm.deliver();
			});

			//#region AP deliver
			if (Users.isLocalUser(user) && !dontFederateInitially) {
				(async () => {
					const noteActivity = await renderNoteOrRenoteActivity(data, note);
					const dm = new DeliverManager(user, noteActivity);

					// メンションされたリモートユーザーに配送
					for (const u of mentionedUsers.filter((u) => Users.isRemoteUser(u))) {
						dm.addDirectRecipe(u as IRemoteUser);
					}

					// 投稿がリプライかつ投稿者がローカルユーザーかつリプライ先の投稿の投稿者がリモートユーザーなら配送
					if (data.reply && data.reply.userHost !== null) {
						const u = await Users.findOneBy({ id: data.reply.userId });
						if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
					}

					// 投稿がRenoteかつ投稿者がローカルユーザーかつRenote元の投稿の投稿者がリモートユーザーなら配送
					if (data.renote && data.renote.userHost !== null) {
						const u = await Users.findOneBy({ id: data.renote.userId });
						if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
					}

					// フォロワーに配送
					if (["public", "home", "followers"].includes(note.visibility)) {
						if (
							data.reply &&
							data.reply.userId === user.id &&
							data.reply.replyId
						) {
							// 自己リプライでリプライのリプライがある場合
							// リプライのリプライが自分ではない場合
							if (
								data.reply.replyUserId !== user.id &&
								data.reply.replyUserHost === null
							) {
								console.log(`reReply deliver : ${data.reply.replyId}`);
								const u = await Users.findOneBy({ id: data.reply.replyUserId });
								dm.addFollowersRecipe(u as ILocalUser);
							} else {
								console.log(`reReply deliver : ${data.reply.replyId}`);
								// リプライのリプライが自分の場合
								dm.addFollowersRecipe();
							}
						} else if (
							data.reply &&
							data.reply.userId !== user.id &&
							data.reply.userHost === null
						) {
							console.log(`reply deliver : ${data.reply.id}`);
							// 他人宛のリプライがある場合
							const u = await Users.findOneBy({ id: data.reply.userId });
							dm.addFollowersRecipe(u as ILocalUser);
						} else {
							dm.addFollowersRecipe();
						}
					}

					//リレーに配送
					if (["public"].includes(note.visibility)) {
						deliverToRelays(user, noteActivity);
					}

					dm.execute();
				})();
			}
			//#endregion
		}

		if (data.channel && (!data.renote || data.text != null)) {
			Channels.increment({ id: data.channel.id }, "notesCount", 1);
			Channels.update(data.channel.id, {
				lastNotedAt: new Date(),
			});

			const count = await Notes.countBy({
				userId: user.id,
				channelId: data.channel.id,
			}).then((count) => {
				// この処理が行われるのはノート作成後なので、ノートが一つしかなかったら最初の投稿だと判断できる
				// TODO: とはいえノートを削除して何回も投稿すればその分だけインクリメントされる雑さもあるのでどうにかしたい
				if (count === 1) {
					Channels.increment({ id: data.channel!.id }, "usersCount", 1);
				}
			});
		}

		// Register to search database
		await index(note);
	});

export async function appendNoteVisibleUser(
	user: {
		id: User["id"];
		username: User["username"];
		host: User["host"];
		isBot: User["isBot"];
		isCat: User["isCat"];
	},
	note: Note,
	additionalUserId: ILocalUser["id"],
) {
	if (note.visibility !== "specified") return;
	if (note.visibleUserIds.includes(additionalUserId)) return;
	if (note.ccUserIds.includes(additionalUserId)) return;

	const additionalUser = await Users.findOneByOrFail({
		id: additionalUserId,
		host: IsNull(),
	});

	// ノートのvisibleUserIdsを更新
	await Notes.update(note.id, {
		ccUserIds: () => `array_append("ccUserIds", "${additionalUser.id}")`,
	});

	// 新しい対象ユーザーにだけ処理が行われるようにする
	note.visibleUserIds = [];
	note.ccUserIds = [additionalUser.id];

	// ストリームに流す
	const noteObj = await Notes.pack(note, null);
	publishNotesStream(noteObj);
}

async function renderNoteOrRenoteActivity(data: Option, note: Note) {
	if (data.localOnly && data.channel) return null;
	// リモートでRT出来ないはずの投稿がRTされている場合、連合しない
	if (data.renote?.userId !== note.userId && data.renote?.localOnly)
		return null;

	const content =
		data.renote &&
		data.text == null &&
		data.poll == null &&
		(data.files == null || data.files.length === 0)
			? renderAnnounce(
					data.renote.uri
						? data.renote.uri
						: `${config.url}/notes/${data.renote.id}`,
					note,
			  )
			: renderCreate(await renderNote(note, false), note);

	return renderActivity(content);
}

function incRenoteCount(renote: Note, userHost?: string) {
	Notes.createQueryBuilder()
		.update()
		.set({
			renoteCount: () => '"renoteCount" + 1',
			score: () => `"score" + ${userHost ? "3" : "9"}`,
		})
		.where("id = :id", { id: renote.id })
		.execute();
}

async function insertNote(
	user: { id: User["id"]; host: User["host"] },
	data: Option,
	tags: string[],
	emojis: string[],
	mentionedUsers: MinimumUser[],
) {
	const insert = new Note({
		id: genId(data.createdAt!),
		createdAt: data.createdAt!,
		fileIds: data.files ? data.files.map((file) => file.id) : [],
		replyId: data.reply ? data.reply.id : null,
		renoteId: data.renote ? data.renote.id : null,
		channelId: data.channel ? data.channel.id : null,
		threadId: data.reply
			? data.reply.threadId
				? data.reply.threadId
				: data.reply.id
			: null,
		name: data.name,
		text: data.text,
		hasPoll: data.poll != null,
		cw: data.cw == null ? null : data.cw,
		tags: tags.map((tag) => normalizeForSearch(tag)),
		emojis,
		userId: user.id,
		localOnly: data.localOnly!,
		visibility: data.visibility as any,
		visibleUserIds:
			data.visibility === "specified"
				? data.visibleUsers
					? data.visibleUsers.map((u) => u.id)
					: []
				: [],
		ccUserIds:
			data.visibility === "specified"
				? data.ccUsers
					? data.ccUsers.map((u) => u.id)
					: []
				: [],
		attachedFileTypes: data.files ? data.files.map((file) => file.type) : [],
		referenceIds: data.references || [],
		isPublicLikeList: data.isPublicLikeList ?? undefined,
		isFirstNote: !!data.isFirstNote,
		// 以下非正規化データ
		replyUserId: data.reply ? data.reply.userId : null,
		replyUserHost: data.reply ? data.reply.userHost : null,
		renoteUserId: data.renote ? data.renote.userId : null,
		renoteUserHost: data.renote ? data.renote.userHost : null,
		userHost: user.host,
	});

	if (data.uri != null) insert.uri = data.uri;
	if (data.url != null) insert.url = data.url;

	// Append mentions data
	if (mentionedUsers.length > 0) {
		insert.mentions = mentionedUsers.map((u) => u.id);
		const profiles = await UserProfiles.findBy({ userId: In(insert.mentions) });
		insert.mentionedRemoteUsers = JSON.stringify(
			mentionedUsers
				.filter((u) => Users.isRemoteUser(u))
				.map((u) => {
					const profile = profiles.find((p) => p.userId === u.id);
					const url = profile != null ? profile.url : null;
					return {
						uri: u.uri,
						url: url == null ? undefined : url,
						username: u.username,
						host: u.host,
					} as IMentionedRemoteUsers[0];
				}),
		);
	}

	// 投稿を作成
	try {
		if (insert.hasPoll) {
			// Start transaction
			await db.transaction(async (transactionalEntityManager) => {
				await transactionalEntityManager.insert(Note, insert);

				const poll = new Poll({
					noteId: insert.id,
					choices: data.poll!.choices,
					expiresAt: data.poll!.expiresAt,
					multiple: data.poll!.multiple,
					votes: new Array(data.poll!.choices.length).fill(0),
					noteVisibility: insert.visibility,
					userId: user.id,
					userHost: user.host,
				});

				await transactionalEntityManager.insert(Poll, poll);
			});
		} else {
			await Notes.insert(insert);
		}

		return insert;
	} catch (e) {
		// duplicate key error
		if (isDuplicateKeyValueError(e)) {
			const err = new Error("Duplicated note");
			err.name = "duplicated";
			throw err;
		}

		console.error(e);

		throw e;
	}
}

export async function index(note: Note): Promise<void> {
	if (!note.text) return;

	if (config.elasticsearch && es) {
		es.index({
			index: config.elasticsearch.index || "misskey_note",
			id: note.id.toString(),
			body: {
				text: normalizeForSearch(note.text),
				userId: note.userId,
				userHost: note.userHost,
			},
		});
	}

	if (sonic) {
		await sonic.ingest.push(
			sonic.collection,
			sonic.bucket,
			JSON.stringify({
				id: note.id,
				userId: note.userId,
				userHost: note.userHost,
				channelId: note.channelId,
			}),
			note.text,
		);
	}
}

async function notifyToWatchersOfRenotee(
	renote: Note,
	user: { id: User["id"] },
	nm: NotificationManager,
	type: NotificationType,
) {
	const watchers = await NoteWatchings.findBy({
		noteId: renote.id,
		userId: Not(user.id),
	});

	for (const watcher of watchers) {
		nm.push(watcher.userId, type);
	}
}

async function notifyToWatchersOfReplyee(
	reply: Note,
	user: { id: User["id"] },
	nm: NotificationManager,
) {
	const watchers = await NoteWatchings.findBy({
		noteId: reply.id,
		userId: Not(user.id),
	});

	for (const watcher of watchers) {
		nm.push(watcher.userId, "reply");
	}
}

async function createMentionedEvents(
	mentionedUsers: MinimumUser[],
	note: Note,
	nm: NotificationManager,
) {
	for (const u of mentionedUsers.filter((u) => Users.isLocalUser(u))) {
		const threadMuted = await NoteThreadMutings.findOneBy({
			userId: u.id,
			threadId: note.threadId || note.id,
		});

		if (threadMuted) {
			continue;
		}

		// note with "specified" visibility might not be visible to mentioned users
		try {
			const detailPackedNote = await Notes.pack(note, u, {
				detail: true,
			});

			publishMainStream(u.id, "mention", detailPackedNote);

			const webhooks = (await getActiveWebhooks()).filter(
				(x) => x.userId === u.id && x.on.includes("mention"),
			);
			for (const webhook of webhooks) {
				webhookDeliver(webhook, "mention", {
					note: detailPackedNote,
				});
			}
		} catch (err) {
			if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24") continue;
			throw err;
		}

		// Create notification
		nm.push(u.id, "mention");
	}
}

function saveReply(reply: Note, note: Note) {
	Notes.increment({ id: reply.id }, "repliesCount", 1);
}

function incNotesCountOfUser(user: { id: User["id"] }) {
	Users.createQueryBuilder()
		.update()
		.set({
			updatedAt: new Date(),
			notesCount: () => '"notesCount" + 1',
		})
		.where("id = :id", { id: user.id })
		.execute();
}

export async function extractMentionedUsers(
	user: { host: User["host"] },
	tokens: mfm.MfmNode[],
): Promise<User[]> {
	if (tokens == null) return [];

	const mentions = extractMentions(tokens);

	let mentionedUsers = (
		await Promise.all(
			mentions.map((m) =>
				resolveUser(m.username, m.host || user.host).catch(() => null),
			),
		)
	).filter((x) => x != null) as User[];

	// Drop duplicate users
	mentionedUsers = mentionedUsers.filter(
		(u, i, self) => i === self.findIndex((u2) => u.id === u2.id),
	);

	return mentionedUsers;
}

function kana_to_hira(str) {
	return str.replace(/[ァ-ン]/g, function (match) {
		var chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}
