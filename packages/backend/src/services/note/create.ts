/**
 * @packageDocumentation
 *
 * ノート（投稿）の作成処理を行うサービス。
 *
 * @remarks
 * - **役割**: API や AP の Create(Note) から呼ばれ、ノートを DB に保存し配信・ストリーム・検索に反映する。
 * - **投票**: 選択肢は {@link DB_MAX_POLL_CHOICE_LENGTH} を超えないことを検証する（REST 以外の経路で DB 制約エラーを防ぐ）。
 *
 * @see {@link server/api/endpoints/notes/create} ノート作成 API
 * @internal
 */

import * as mfm from "mfm-js";
import es from "../../db/elasticsearch.js";
import sonic from "../../db/sonic.js";
import {
	publishMainStream,
	publishNotesStream,
	publishNoteStream,
} from "@/services/stream.js";
import DeliverManager, {
	deliverToUser,
} from "@/remote/activitypub/deliver-manager.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { resolveUser } from "@/remote/resolve-user.js";
import config from "@/config/index.js";
import { updateHashtags } from "../update-hashtag.js";
import { concat } from "@/prelude/array.js";
import {
	insertNoteUnreadBatch,
	type NoteUnreadCandidate,
} from "@/services/note/unread.js";
import { registerOrFetchInstanceDoc } from "../register-or-fetch-instance-doc.js";
import { extractMentions } from "@/misc/extract-mentions.js";
import { extractCustomEmojisFromMfm } from "@/misc/extract-custom-emojis-from-mfm.js";
import { extractHashtags } from "@/misc/extract-hashtags.js";
import type { IMentionedRemoteUsers } from "@/models/entities/note.js";
import { Note } from "@/models/entities/note.js";
import {
	DriveFiles,
	Mutings,
	Users,
	NoteWatchings,
	Notes,
	Emojis,
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
import { canUseEmoji } from "@/models/repositories/emoji.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { App } from "@/models/entities/app.js";
import { Not, In, IsNull } from "typeorm";
import type { User, ILocalUser, IRemoteUser } from "@/models/entities/user.js";
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
import { isIncludeNgWordIsNote } from "@/misc/is-include-ng-word.js";
import type { Channel } from "@/models/entities/channel.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { getAntennas } from "@/misc/antenna-cache.js";
import { endedPollNotificationQueue } from "@/queue/queues.js";
import { createNoteApDeliverJob, webhookDeliver } from "@/queue/index.js";
import { Cache } from "@/misc/cache.js";
import type { UserProfile } from "@/models/entities/user-profile.js";
import { db } from "@/db/postgre.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { shouldSilenceInstance } from "@/misc/should-block-instance.js";
import { countSameRenotes } from "@/misc/count-same-renotes.js";
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import renderTombstone from "@/remote/activitypub/renderer/tombstone.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { StatusError } from "@/misc/fetch.js";
import { DB_MAX_POLL_CHOICE_LENGTH } from "@/misc/hard-limits.js";

const mutedWordsCache = new Cache<
	{ userId: UserProfile["userId"]; mutedWords: UserProfile["mutedWords"] }[]
>(1000 * 60 * 5);

type NotificationType = "reply" | "renote" | "quote" | "mention";

class NotificationManager {
	private notifier: { id: User["id"] };
	private note: Note;
	private notifierUser: User | undefined;
	private queue: {
		target: ILocalUser["id"];
		reason: NotificationType;
	}[];

	constructor(notifier: { id: User["id"] }, note: Note, notifierUser?: User) {
		this.notifier = notifier;
		this.note = note;
		this.notifierUser = notifierUser;
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
		const targets = [...new Set(this.queue.map((x) => x.target))];

		const mentioneeMutes =
			targets.length === 0
				? []
				: await Mutings.findBy({
					muterId: In(targets),
					muteeId: this.notifier.id,
				});

		const mentioneeMutedNotifierIds = new Set(
			mentioneeMutes.map((mute) => mute.muterId),
		);

		for (const x of this.queue) {
			// 通知される側のユーザーが通知する側のユーザーをミュートしていない限りは通知する
			if (!mentioneeMutedNotifierIds.has(x.target)) {
				createNotification(
					x.target,
					x.reason,
					{
						notifierId: this.notifier.id,
						noteId: this.note.id,
						note: this.note,
					},
					{ notifier: this.notifierUser },
				);
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

type ActiveWebhook = Awaited<ReturnType<typeof getActiveWebhooks>>[number];
type WebhooksByUserMap = Map<MinimumUser["id"], ActiveWebhook[]>;

type Option = {
	createdAt?: Date | null;
	endpointPreprocessMs?: number;
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

type LocalRuleUser = {
	id: User["id"];
	host: null;
	notesCount: User["notesCount"];
	blockPostPublic: User["blockPostPublic"];
	blockPostHome: User["blockPostHome"];
	blockPostNotLocal: User["blockPostNotLocal"];
	blockPostNotLocalPublic: User["blockPostNotLocalPublic"];
};

function includesYoruho(text: Option["text"]): boolean {
	return (
		text?.includes("よるほ") === true ||
		text?.includes("ヨルホ") === true ||
		text?.includes("yoruho") === true
	);
}

async function applyLocalNoteRules(user: LocalRuleUser, data: Option): Promise<void> {
	if (!data.visibilityForce && data.visibility !== "specified") {
		//チャンネル投稿でリプライ、リノートでないならpublic
		if (data.channel != null && !data.reply && !data.renote) data.visibility = "public";
		//publicをブロックする設定でpublic設定ならhomeに設定
		if (user.blockPostPublic && data.visibility === "public") data.visibility = "home";
		//homeをブロックする設定でhome設定ならfollowersに設定
		if (user.blockPostHome && data.visibility === "home") data.visibility = "followers";
		//非localOnlyをブロックする設定で非localOnly設定ならlocalOnlyに設定
		if (
			user.blockPostNotLocal &&
			data.localOnly === false &&
			(!user.blockPostNotLocalPublic || data.visibility === "public")
		) {
			data.localOnly = true;
		}

		//LTLが無効ならホームに
		if (data.channel == null && data.visibility === "public") {
			const m = await fetchMeta();
			if (m.disableLocalTimeline) {
				data.visibility = "home";
			}
		}
	}

	const isEmptyText = !data.text?.trim();
	const isRenoteToSameChannel =
		data.channel != null &&
		data.renote != null &&
		data.renote.channelId === data.channel.id;

	if (
		data.channel != null &&
		data.localOnly === false &&
		!data.reply &&
		!(isEmptyText && isRenoteToSameChannel) &&
		!(data.text ?? "").includes(`#${data.channel.name}`)
	) {
		//ローカル投稿でチャンネルで連合有りで返信でなく、
		//すでにタグが含まれていない場合はハッシュタグを自動で付ける
		data.text = data.text?.trim()
			? `${data.text} #${data.channel.name}`
			: `#${data.channel.name}`;
	}

	// ローカル投稿のTwitter/X statusリンクのみ、?以降を取り除く
	if (data.text?.includes("https://twitter.com") || data.text?.includes("http://twitter.com")) {
		data.text = data.text.replaceAll(
			/(https?:\/\/twitter.com\/\S*\/status\/\S*)(\?[^\s\)]*)/gi,
			"$1",
		);
	}

	if (data.text?.includes("https://x.com") || data.text?.includes("http://x.com")) {
		data.text = data.text.replaceAll(
			/(https?:\/\/x.com\/\S*\/status\/\S*)(\?[^\s\)]*)/gi,
			"$1",
		);
	}

	//ローカルユーザーでこの投稿が1投稿目の場合
	if (user.notesCount < 1) {
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
		includesYoruho(data.text)
	) {
		if (data.createdAt?.getSeconds() === 59 && data.createdAt?.getMilliseconds() !== 0) {
			//誤差がミリ秒単位の場合
			data.text = `${data.text} [❌ -.${(1000 - data.createdAt.getMilliseconds())
				.toString()
				.padStart(3, "0")}]`;
		} else {
			data.text = `${data.text} [❌ -${(60 - data.createdAt?.getSeconds()).toString()}s]`;
		}
	}

	//0:00の間によるほを含む投稿をした場合
	if (
		data.createdAt?.getHours() === 0 &&
		data.createdAt?.getMinutes() === 0 &&
		includesYoruho(data.text)
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
			data.text = `${data.text} [❌ +${data.createdAt?.getSeconds().toString()}s]`;
		}
	}
}

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
		const apiStartedAt = Date.now();

		// 最初に投稿時刻を確定させる
		if (data.createdAt == null) data.createdAt = new Date();

		// 投票の選択肢長（DB varchar と整合。API より長い連合流入もここで明示的に拒否）
		if (data.poll?.choices?.length) {
			for (const choice of data.poll.choices) {
				if (Array.from(choice).length > DB_MAX_POLL_CHOICE_LENGTH) {
					const pollChoiceTooLong = `投票の選択肢が長すぎます（1 肢あたり最大 ${DB_MAX_POLL_CHOICE_LENGTH} 文字相当）。`;
					return rej(new StatusError(pollChoiceTooLong, 400, pollChoiceTooLong));
				}
			}
		}

		const isRemote = Users.isRemoteUser(user);
		const firstVisibility = data.visibility ?? "public";

		// リモートのノートはチャンネル扱いにしない
		if (isRemote) {
			data.channel = null;
		}

		const dontFederateInitially =
			(data.localOnly && data.channel) || data.visibility === "hidden";

		if (Users.isLocalUser(user)) {
			// 参照される channelId を集めて 1 回で取得
			const channelIds = new Set<string>();
			if (data.reply?.channelId) channelIds.add(data.reply.channelId);
			if (data.renote?.channelId) channelIds.add(data.renote.channelId);
			const channelMap = new Map<string, Channel>();
			if (channelIds.size > 0) {
				const channels = await Channels.findBy({ id: In([...channelIds]) });
				for (const ch of channels) channelMap.set(ch.id, ch);
			}

			// チャンネル外から返信する場合、対象の公開範囲に合わせる
			// TODO (クライアント側で行う処理にできると思うが、現状はサーバー側で実施)
			if (
				data.reply &&
				data.channel &&
				data.reply.channelId !== data.channel.id
			) {
				data.channel = data.reply.channelId
					? channelMap.get(data.reply.channelId) ?? null
					: null;
			}
			if (
				data.renote &&
				data.channel &&
				data.renote.channelId !== data.channel.id
			) {
				data.channel = data.renote.channelId
					? channelMap.get(data.renote.channelId) ?? null
					: null;
			}

			// チャンネル内で返信する場合、対象の公開範囲に合わせる
			// TODO (クライアント側で行う処理にできると思うが、現状はサーバー側で実施)
			if (data.reply && data.channel == null && data.reply.channelId) {
				data.channel = channelMap.get(data.reply.channelId) ?? null;
			}
			if (data.renote && data.channel == null && data.renote.channelId) {
				data.channel = channelMap.get(data.renote.channelId) ?? null;
			}
		}

		//指定がなければpublicでlocalOnlyOFF
		if (data.visibility == null) data.visibility = "public";
		if (data.localOnly == null) data.localOnly = false;
		if (isRemote) {
			if (!data.visibilityForce && data.visibility !== "specified") {
				if (data.visibility === "hidden") data.visibility = "public";
			}
		} else {
			await applyLocalNoteRules(user, data);
			if (!data.visibilityForce && data.visibility !== "specified") {
				if (data.visibility === "hidden") data.visibility = "public";
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

		// サイレンスされている場合はフォロワー限定に
		if (user.isSilenced && data.visibility !== "specified") {
			data.visibility = "followers";
			data.localOnly = true;
		}

		// ユーザーがサイレンスインスタンスにいる場合はホーム公開に制限
		if (
			data.visibility === "public" &&
			isRemote &&
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
                                        new StatusError(
                                                "削除された投稿に対して返信されました。削除リクエストを送信しました。",
                                                403,
                                                "削除された投稿に対して返信されました。削除リクエストを送信しました。",
                                        ),
                                );
			} else {
                                return rej(
                                        new StatusError(
                                                "削除された投稿に対しては返信できません。",
                                                403,
                                                "削除された投稿に対しては返信できません。",
                                        ),
                                );
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

                                const author = await Users.findOne({
                                        where: {
                                                id: data.renote.userId,
                                                host: IsNull(),
                                                isDeleted: true,
                                        },
                                });
                                if (author && u && Users.isRemoteUser(u)) {
                                        const del = renderActivity(
                                                renderDelete(
                                                        `${config.url}/users/${author.id}`,
                                                        author as ILocalUser,
                                                ),
                                        );
                                        await deliverToUser(author as ILocalUser, del, u);
                                }
                                return rej(
                                        new StatusError(
                                                "削除された投稿がRTされました。削除リクエストを送信しました。",
                                                403,
                                                "削除された投稿がRTされました。削除リクエストを送信しました。",
                                        ),
                                );
			} else {
                                return rej(
                                        new StatusError(
                                                "削除された投稿はRTできません。",
                                                403,
                                                "削除された投稿はRTできません。",
                                        ),
                                );
			}
		}

		// リノート先が「ホームまたは全体」以外の公開範囲の場合は拒否
		if (
			data.renote &&
			data.renote.visibility !== "public" &&
			data.renote.visibility !== "home" &&
			data.renote.userId !== user.id
		) {
                        return rej(
                                new StatusError(
                                        "Renote target is not public or home",
                                        403,
                                        "Renote target is not public or home",
                                ),
                        );
		}

               if (!data.visibilityForce && data.visibility !== "specified") {
                        // リノート先が公開でない場合はホームに合わせる
                        if (
                                data.renote &&
                                data.renote.visibility !== "public" &&
                                data.visibility === "public"
                        ) {
                                data.visibility = "home";
                        }

                        // リノート先がフォロワーの場合はフォロワーに合わせる
                        if (data.renote && data.renote.visibility === "followers") {
                                data.visibility = "followers";
                        }

		// 返信先が公開でない場合はホームに合わせる
		if (
			data.reply &&
			data.reply.visibility !== "public" &&
			data.visibility === "public"
		) {
			data.visibility = "home";
		}

		// 返信先がフォロワーの場合はフォロワーに合わせる
		if (
			data.reply &&
			data.reply.visibility === "followers" &&
			(data.visibility === "public" || data.visibility === "home")
		) {
			data.visibility = "followers";
		}

		// 返信先が指定の場合は指定に合わせる
		if (
			data.reply &&
			data.reply.visibility === "specified" &&
			data.visibility !== "specified"
		) {
			data.visibility = "specified";
		}

		// リノート先がローカルのみの場合はローカルのみに合わせる
		if (data.renote?.localOnly) {
			data.localOnly = true;
		}

		// 返信先がローカルのみの場合はローカルのみに合わせる
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
                                new StatusError(
                                        "この内容の返信は現在制限されています。絵文字だけの返信なら、リアクション機能を使用してみませんか？",
                                        403,
                                        "この内容の返信は現在制限されています。絵文字だけの返信なら、リアクション機能を使用してみませんか？",
                                ),
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
                                                return rej(
                                                        new StatusError(
                                                                "CW無しで投稿できないワードが本文に含まれています。",
                                                                403,
                                                                "CW無しで投稿できないワードが本文に含まれています。",
                                                        ),
                                                );
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

		// 必要に応じて MFM をパース
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
                        ?.filter((tag) => Array.from(tag || "").length <= 128)
                        .splice(0, 32);

                if (!user.host && tags?.some((tag) => tag?.toLowerCase() === "misshaialert")) {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const startOfYesterday = new Date(startOfToday);
                        startOfYesterday.setDate(startOfYesterday.getDate() - 1);

                        const yesterdayCount = await Notes.createQueryBuilder("note")
                                .where("note.userId = :userId", { userId: user.id })
                                .andWhere("note.createdAt >= :startOfYesterday", { startOfYesterday })
                                .andWhere("note.createdAt < :startOfToday", { startOfToday })
                                .getCount();

                        if (yesterdayCount <= 1) {
                                return rej(
                                        new StatusError(
                                                "前日の投稿数が1以下のため、このハッシュタグ付きの投稿はできません。",
                                                403,
                                                "前日の投稿数が1以下のため、このハッシュタグ付きの投稿はできません。",
                                        ),
                                );
                        }
                }

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
                                return rej(
                                        new StatusError(
                                                "禁止タグが含まれています。",
                                                403,
                                                "禁止タグが含まれています。",
                                        ),
                                );
			/*
                        if (
                                mentionedUsers?.length > 3 &&
                                data.text?.includes("https://discord.gg/")
                        )
                                return rej(
                                        new StatusError(
                                                "禁止投稿です。(discordへの誘導)",
                                                403,
                                                "禁止投稿です。(discordへの誘導)",
                                        ),
                                );
                        if (
                                mentionedUsers?.length > 7 &&
                                (data.text?.includes("ap12") || data.text?.includes("猫"))
                        )
                                return rej(
                                        new StatusError(
                                                "禁止投稿です。(メンション多すぎ)",
                                                403,
                                                "禁止投稿です。(メンション多すぎ)",
                                        ),
                                );
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
                                            async (x) =>
                                                    !(
                                                            await Users.getRelation(
                                                                    user.id,
                                                                    x.id,
                                                                    x,
                                                            )
                                                    ).isFollowed,
					);
				console.log(`localRelation: ${!localRelation}`);
                                if (localRelation)
                                        return rej(
                                                new StatusError(
                                                        "禁止投稿です。(スパムの可能性が高い)",
                                                        403,
                                                        "禁止投稿です。(スパムの可能性が高い)",
                                                ),
                                        );
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
			// NOTE: avatarUrl は User 型に無いが、ランタイムでは relation 等で設定されていることがある
			(!user.avatarId || (user as unknown as { avatarUrl?: string }).avatarUrl?.includes("identicon"))
	) {
			const localMentioned = mentionedUsers.filter(
				(x) => !x.host || x.host === config.host,
			);
			const localMentionIds = localMentioned.map((x) => x.id);
			const localRelationsMap =
				localMentionIds.length > 0
					? await Users.getRelationsBulk(user.id, localMentionIds, undefined)
					: new Map<string, { isFollowed: boolean }>();
			const localRelation = localMentioned.every(
				(x) => !localRelationsMap.get(x.id)?.isFollowed,
			);
			console.log(`localRelation: ${!localRelation}`);
                        if (localRelation)
                                return rej(
                                        new StatusError(
                                                "禁止投稿です。(怪しいプロフィール)",
                                                403,
                                                "禁止投稿です。(怪しいプロフィール)",
                                        ),
                                );
		}

		if (user.host && ["public", "home"].includes(data.visibility) && config.specialServerHosts?.includes(user.host) &&
			mentionedUsers.filter((x) => !x.host || x.host === config.host).length == 0 && Math.random() < 0.1) {
                        return rej(
                                new StatusError(
                                        "スパムの可能性あり",
                                        403,
                                        "スパムの可能性あり",
                                ),
                        );
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

			let relation: boolean[] | undefined;
			if (user.isSilenced && data.visibleUsers.length > 0) {
				const visibleUserIds = data.visibleUsers.map((x) => x.id);
				const [visibleRelationsMap, visibleUsersForAdmin] = await Promise.all([
					Users.getRelationsBulk(user.id, visibleUserIds, undefined),
					Users.find({
						where: { id: In(visibleUserIds) },
						select: ["id", "isAdmin"],
					}),
				]);
				const adminByUserId = new Map(
					visibleUsersForAdmin.map((u) => [u.id, u.isAdmin]),
				);
				relation = data.visibleUsers.map(
					(x) =>
						(visibleRelationsMap.get(x.id)?.isFollowed ?? false) ||
						(adminByUserId.get(x.id) ?? false),
				);
			}

			if (user.isSilenced && (!relation?.every((x) => x) ?? true)) {
                                return rej(
                                        new StatusError(
                                                "サイレンス中はフォロワーでも管理人でもないユーザにダイレクトは送信できません。",
                                                403,
                                                "サイレンス中はフォロワーでも管理人でもないユーザにダイレクトは送信できません。",
                                        ),
                                );
			}
		}

		data.isPublicLikeList = user.isPublicLikeList;

		// 投稿に含まれるカスタム絵文字の使用権限（usageVisibility・モチーフ）をチェック（ローカルユーザ＋ローカル絵文字のみ。リモートは対象外）
		if (emojis && emojis.length > 0 && !user.host) {
			const followings = await Followings.findBy({ followerId: user.id });
			const followeeIds = new Set(followings.map((f) => f.followeeId));

			// 使用 (name, host) を一意に列挙して 1 回で一括取得
			const emojiKeySet = new Map<string, { name: string; host: string | null }>();
			for (const emojiName of emojis) {
				const at = emojiName.indexOf("@");
				const name = at < 0 ? emojiName : emojiName.slice(0, at);
				const host = at < 0 ? null : emojiName.slice(at + 1) || null;
				const key = `${name}\t${host ?? ""}`;
				if (!emojiKeySet.has(key)) emojiKeySet.set(key, { name, host });
			}
			if (emojiKeySet.size > 0) {
				const conditions = [...emojiKeySet.values()].map(({ name, host }) => ({
					name,
					host: host === null || host === "" ? IsNull() : host,
				}));
				const foundEmojis = await Emojis.find({
					where: conditions,
					select: [
						"name",
						"host",
						"usageVisibility",
						"allowedUserIds",
						"motifUserId",
						"motifUserMode",
						"category",
					],
				});
				const emojiMap = new Map<string, (typeof foundEmojis)[number]>();
				for (const e of foundEmojis) {
					emojiMap.set(`${e.name}\t${e.host ?? ""}`, e);
				}
				for (const emojiName of emojis) {
					const at = emojiName.indexOf("@");
					const name = at < 0 ? emojiName : emojiName.slice(0, at);
					const host = at < 0 ? null : emojiName.slice(at + 1) || null;
					const key = `${name}\t${host ?? ""}`;
					const emoji = emojiMap.get(key);
					if (emoji && emoji.host == null && !canUseEmoji(emoji, user, followeeIds)) {
						return rej(
							new StatusError(
								"使用権限のない絵文字が含まれています。",
								403,
								"使用権限のない絵文字が含まれています。",
							),
						);
					}
				}
			}
		}

		const insertNoteStartedAt = Date.now();
		const note = await insertNote(user, data, tags, emojis, mentionedUsers);
		const insertNoteMs = Date.now() - insertNoteStartedAt;

		const usageTargetIds = (data.files ?? [])
			.map((file) => file?.id)
			.filter((id): id is DriveFile["id"] => Boolean(id));
		if (usageTargetIds.length > 0) {
			try {
				await DriveFiles.adjustUsageCount(usageTargetIds, 1);
			} catch (err) {
				console.warn("Failed to increment drive file usage count", err);
			}
		}

		if (firstVisibility != note.visibility) console.log(`${note.id}:可視性変更 ${firstVisibility} -> ${note.visibility}`);
		const apiResponseMs = Date.now() - apiStartedAt;
		if (apiResponseMs >= 1000) {
			const endpointPreprocessMs = data.endpointPreprocessMs ?? 0;
			console.log(
				`[note-deliver-metric] api_response_ms=${apiResponseMs} endpoint_preprocess_ms=${endpointPreprocessMs} insert_note_ms=${insertNoteMs} note_id=${note.id} user_id=${user.id} user_host=${user.host ?? "local"} visibility=${note.visibility} is_reply=${Boolean(data.reply)} is_renote=${Boolean(data.renote)} file_count=${data.files?.length ?? 0}`,
			);
		}

		res(note);

		// 統計を更新
		notesChart.update(note, true, user.isBot);
		if (data.visibility !== "specified") {
			perUserNotesChart.update(user, note, true, user.isBot);
		}

		// ホストを登録
		if (isRemote) {
			registerOrFetchInstanceDoc(user.host).then((i) => {
				Instances.increment({ id: i.id }, "notesCount", 1);
				instanceChart.updateNote(i.host, note, true);
			});
		}

		// ハッシュタグ更新
		if (data.visibility === "public" || data.visibility === "home") {
			updateHashtags(user, tags);
		}

		// ノート数（ユーザー）をインクリメント
		if (data.visibility !== "specified") incNotesCountOfUser(user);

		// リモートユーザまたはbotの投稿時、ユーザの最終更新時刻を更新
		// 2時間前以上の場合は更新しない
		// TODO : 更新した時に時刻が戻る可能性あり
		if (
			(user.onlineStatus === "online" ||
				user.onlineStatus === "half-online" ||
				isRemote ||
				user.isBot) &&
			new Date().valueOf() - data.createdAt.valueOf() < 2 * 60 * 60 * 1000
		) {
			Users.update(user.id, {
				lastActiveDate: data.createdAt,
			});
		}

		// ワードミュート
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

		// Antenna（指定投稿は checkHitAntenna が常に false のためループをスキップ）
		if (note.visibility !== "specified") {
			for (const antenna of await getAntennas()) {
				checkHitAntenna(antenna, note, user).then((hit) => {
					if (hit) {
						addNoteToAntenna(antenna, note, user, {
							reply: data.reply ?? null,
							renote: data.renote ?? null,
							user,
						});
					}
				});
			}
		}

		if (data.reply) {
			saveReply(data.reply, note);
		}

		let sameRenoteCount: number | null = null;

		// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
		if (data.renote && !user.isBot) {
			sameRenoteCount = await countSameRenotes(user.id, data.renote.id, note.id);
			if (sameRenoteCount === 0) {
				incRenoteCount(data.renote, user.host);
			}
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
			const activeWebhooks = await getActiveWebhooks();
			const noteWebhooksByUser = createWebhooksByUserMap(activeWebhooks, "note");
			const replyWebhooksByUser = createWebhooksByUserMap(
				activeWebhooks,
				"reply",
			);
			const renoteWebhooksByUser = createWebhooksByUserMap(
				activeWebhooks,
				"renote",
			);
			const mentionWebhooksByUser = createWebhooksByUserMap(
				activeWebhooks,
				"mention",
			);

			if (Users.isLocalUser(user)) activeUsersChart.write(user);

			// 未読通知を一括作成（channel フォロワー・指定・メンションの候補を集めて 1 回で挿入）
			const unreadCandidates: NoteUnreadCandidate[] = [];
			if (note.channelId) {
				const channelFollowings = await ChannelFollowings.findBy({
					followeeId: note.channelId,
				});
				unreadCandidates.push(
					...channelFollowings.map((f) => ({
						userId: f.followerId,
						isSpecified: false as const,
						isMentioned: false as const,
					})),
				);
			}
			if (data.visibility === "specified") {
				if (data.visibleUsers == null) throw new Error("invalid param");
				for (const u of data.visibleUsers) {
					if (!Users.isLocalUser(u)) continue;
					unreadCandidates.push({
						userId: u.id,
						isSpecified: true,
						isMentioned: false,
					});
				}
			} else {
				for (const u of mentionedUsers) {
					if (!Users.isLocalUser(u)) continue;
					unreadCandidates.push({
						userId: u.id,
						isSpecified: false,
						isMentioned: true,
					});
				}
			}
			await insertNoteUnreadBatch(note, unreadCandidates);

			if (data.visibility !== "hidden") {
				publishNotesStream(note);
			}
			if (note.replyId != null) {
				// 受信者がノートを見る権限がない場合があるため、ここでは返信ノートの id のみ渡す
				publishNoteStream(note.replyId, "replied", {
					id: note.id,
				});
			}

			const webhooks = noteWebhooksByUser.get(user.id) ?? [];
			const packedNoteForWebhook =
				webhooks.length > 0 ? await Notes.pack(note, user) : null;
			for (const webhook of webhooks) {
				webhookDeliver(webhook, "note", {
					note: packedNoteForWebhook!,
				});
			}

			const nm = new NotificationManager(user, note, user);
			const nmRelatedPromises = [];

			const localMentionTargets = await enqueueMentionNotifications(
				mentionedUsers,
				note,
				nm,
			);

			// 返信先ノートがある場合
			if (data.reply) {
				// ウォッチャーを取得
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

						const webhooks = replyWebhooksByUser.get(data.reply.userId) ?? [];
						for (const webhook of webhooks) {
							if (webhook.userId === user.id) continue;
							webhookDeliver(webhook, "reply", {
								note: packedReply,
							});
						}
					}
				}
			}

			// リノートの場合
			if (data.renote) {
				const isRenote = !(data.text || data.files?.length || data.poll);

				const type = !isRenote ? "quote" : "renote";

				// 通知
				if (data.renote.userHost === null) {
					const threadMuted = await NoteThreadMutings.findOneBy({
						userId: data.renote.userId,
						threadId: data.renote.threadId || data.renote.id,
					});

					if (!threadMuted) {
						nm.push(data.renote.userId, type);
					}
				}

				// ウォッチャーを取得
				nmRelatedPromises.push(
					notifyToWatchersOfRenotee(data.renote, user, nm, type),
				);

				// イベントを発行
				if (user.id !== data.renote.userId && data.renote.userHost === null) {
					const packedRenote = await Notes.pack(note, {
						id: data.renote.userId,
					});
					publishMainStream(data.renote.userId, "renote", packedRenote);

					const webhooks = renoteWebhooksByUser.get(data.renote.userId) ?? [];
					for (const webhook of webhooks) {
						if (webhook.userId === user.id) continue;
						webhookDeliver(webhook, "renote", {
							note: packedRenote,
						});
					}
				}
			}

			void createMentionedEventsInBackground(
				localMentionTargets,
				note,
				mentionWebhooksByUser,
			);

			Promise.all(nmRelatedPromises).then(() => {
				nm.deliver();
			});

			//#region AP 配信
			if (Users.isLocalUser(user) && !dontFederateInitially) {
				createNoteApDeliverJob({
					noteId: note.id,
					queuedAt: Date.now(),
					sameRenoteCount,
				});
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

		// 検索DBに登録
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
	// isBotMention 判定用に CW+本文のみパース（追加 I/O なし、既存 mentionedUsers を参照）
	const tokensForFlag = data.text ? mfm.parse(data.text)! : [];
	const cwTokensForFlag = data.cw ? mfm.parse(data.cw)! : [];
	const isBotMention = determineIsBotMentionAtHead(
		cwTokensForFlag,
		tokensForFlag,
		mentionedUsers,
	);

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
		isBotMention,
		// 以下非正規化データ
		replyUserId: data.reply ? data.reply.userId : null,
		replyUserHost: data.reply ? data.reply.userHost : null,
		renoteUserId: data.renote ? data.renote.userId : null,
		renoteUserHost: data.renote ? data.renote.userHost : null,
		userHost: user.host,
	});

	if (data.uri != null) insert.uri = data.uri;
	if (data.url != null) insert.url = data.url;

	// メンションデータを付加
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
			// トランザクション開始
			await db.transaction(async (transactionalEntityManager) => {
				await transactionalEntityManager.insert(Note, insert);

				const poll = new Poll({
					noteId: insert.id,
					choices: data.poll!.choices,
					expiresAt: data.poll!.expiresAt,
					multiple: data.poll!.multiple,
					hideResults: data.poll!.hideResults ?? false,
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
		// 重複キーエラー
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

async function enqueueMentionNotifications(
	mentionedUsers: MinimumUser[],
	note: Note,
	nm: NotificationManager,
): Promise<MinimumUser[]> {
	const localMentionedUsers = mentionedUsers.filter((u) => Users.isLocalUser(u));
	if (localMentionedUsers.length === 0) return [];

	const targetThreadId = note.threadId || note.id;
	const mutedThreadUserIds = new Set<MinimumUser["id"]>();
	const threadMutings = await NoteThreadMutings.findBy({
		userId: In(localMentionedUsers.map((u) => u.id)),
		threadId: targetThreadId,
	});

	for (const muting of threadMutings) {
		mutedThreadUserIds.add(muting.userId);
	}

	const mentionTargets = localMentionedUsers.filter(
		(u) => !mutedThreadUserIds.has(u.id),
	);

	for (const u of mentionTargets) {
		nm.push(u.id, "mention");
	}

	return mentionTargets;
}

function createMentionedEventsInBackground(
	localMentionedUsers: MinimumUser[],
	note: Note,
	mentionWebhooksByUser: WebhooksByUserMap,
): void {
	if (localMentionedUsers.length === 0) return;

	void (async () => {
		const errors: unknown[] = [];

		// 同一 note をメンション先ごとの me で pack するため一括取得してから配列で pack
		const packedNotes = await Notes.packForViewers(note, localMentionedUsers, {
			detail: true,
		});

		for (let i = 0; i < localMentionedUsers.length; i++) {
			const u = localMentionedUsers[i];
			const detailPackedNote = packedNotes[i];
			if (detailPackedNote == null) continue;
			try {
				publishMainStream(u.id, "mention", detailPackedNote);

				const mentionWebhooks = mentionWebhooksByUser.get(u.id);
				if (mentionWebhooks) {
					for (const webhook of mentionWebhooks) {
						webhookDeliver(webhook, "mention", {
							note: detailPackedNote,
						});
					}
				}
			} catch (err) {
				if (isNotePackAccessDeniedError(err)) continue;
				errors.push({ userId: u.id, err });
			}
		}

		if (errors.length > 0) {
			console.error("[notes/create] mention event errors", {
				noteId: note.id,
				errorCount: errors.length,
				errors,
			});
		}
	})().catch((err) => {
		console.error("[notes/create] mention event background job failed", {
			noteId: note.id,
			err,
		});
	});
}

function createWebhooksByUserMap(
	webhooks: ActiveWebhook[],
	event: "note" | "reply" | "renote" | "mention",
): WebhooksByUserMap {
	const webhooksByUser = new Map<MinimumUser["id"], ActiveWebhook[]>();

	for (const webhook of webhooks) {
		if (!webhook.on.includes(event)) continue;

		const userWebhooks = webhooksByUser.get(webhook.userId) ?? [];
		userWebhooks.push(webhook);
		webhooksByUser.set(webhook.userId, userWebhooks);
	}

	return webhooksByUser;
}

function isNotePackAccessDeniedError(err: unknown): boolean {
	if (typeof err !== "object" || err === null || !("id" in err)) return false;
	return err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24";
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

/**
 * ノード配列の先頭（空白のみのノードをスキップ後）がメンションノードかどうかを返す。
 * @param nodes - MFM ノード配列（CW または本文）
 * @returns 先頭の実質的な最初のノードが mention なら true
 * @internal
 */
function firstNonWhitespaceNodeIsMention(nodes: mfm.MfmNode[]): boolean {
	if (nodes.length === 0) return false;
	for (const node of nodes) {
		if (node.type === "text") {
			const text = (node as { props?: { text?: string } }).props?.text;
			if (text != null && text.trim() === "") continue; // 空白のみはスキップ
			return false; // 非空白テキストが先頭 => メンションではない
		}
		if (node.type === "mention") return true;
		return false; // その他のノードが先頭 => メンションではない
	}
	return false;
}

/**
 * 文頭（CW または本文の先頭、空白無視）で Bot 1件のみメンションしているかどうかを判定する。
 * 追加の DB/AP 解決は行わず、既存の mentionedUsers のみを参照する。
 *
 * @param cwTokens - CW の MFM ノード配列（ない場合は []）
 * @param tokens - 本文の MFM ノード配列
 * @param mentionedUsers - 既に解決済みのメンション先ユーザ一覧（combined でよい）
 * @returns 文頭にメンションがあり、CW+本文でメンション対象が1人かつそのユーザが Bot のとき true
 * @remarks
 * - CW あり: CW 先頭または本文先頭のどちらかがメンションなら「文頭にメンションあり」。
 * - CW+本文のみでメンション数を数え、アンケート選択肢は含めない。
 * - 一致するユーザが mentionedUsers にいない（解決失敗等）場合は false。
 * @internal
 */
function determineIsBotMentionAtHead(
	cwTokens: mfm.MfmNode[],
	tokens: mfm.MfmNode[],
	mentionedUsers: User[],
): boolean {
	const headOk =
		firstNonWhitespaceNodeIsMention(tokens) ||
		(cwTokens.length > 0 && firstNonWhitespaceNodeIsMention(cwTokens));
	if (!headOk) return false;

	const mentionProps = extractMentions(tokens.concat(cwTokens));
	const uniq = new Map<string, { username: string; host: string | null }>();
	for (const m of mentionProps) {
		const key = `${m.username}\t${m.host ?? ""}`;
		if (!uniq.has(key)) uniq.set(key, { username: m.username, host: m.host ?? null });
	}
	if (uniq.size !== 1) return false;

	const [only] = uniq.values();
	const user = mentionedUsers.find(
		(u) =>
			u.username === only.username &&
			(u.host ?? null) === only.host,
	);
	return user != null && user.isBot === true;
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

	// 重複ユーザーを除外
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
