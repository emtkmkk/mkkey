/**
 * @packageDocumentation
 *
 * ノートを作成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/create`（クライアントからは POST `/api/notes/create` で呼び出し）
 * - 認証必須。テキスト・投票・ファイル添付・リノート・返信・チャンネル投稿に対応。
 * - 公開範囲（visibility）、CW、ローカルのみ、Idempotency キーなどオプションあり。
 * - レート制限: 1 時間あたり 300 回（meta.limit）。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { In, IsNull } from "typeorm";
import create from "@/services/note/create.js";
import type { User } from "@/models/entities/user.js";
import {
	Users,
	DriveFiles,
	Notes,
	Channels,
	Blockings,
} from "@/models/index.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { Note } from "@/models/entities/note.js";
import type { Channel } from "@/models/entities/channel.js";
import { MAX_NOTE_TEXT_LENGTH } from "@/const.js";
import { noteVisibilities } from "../../../../types.js";
import { ApiError } from "../../error.js";
import { StatusError } from "@/misc/fetch.js";
import define from "../../define.js";
import { HOUR } from "@/const.js";
import { getNote } from "../../common/getters.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { publishMainStream } from "@/services/stream.js";
import { redisClient } from "@/db/redis.js";

const NOTES_CREATE_IDEMPOTENCY_TTL_SEC = 60;

function normalizeIdempotencyKey(key: unknown): string | null {
	if (typeof key !== "string") return null;
	const normalized = key.trim();
	return normalized.length > 0 ? normalized : null;
}

export const meta = {
	tags: ["notes"],

	requireCredential: true,

	description:
		"新規投稿を作成する。テキスト・投票・ファイル添付・リノート・返信・チャンネル投稿・参照投稿に対応。公開範囲・CW・ローカルのみ・visibleUserIds などで公開先を指定できる。冪等キーで重複送信を防げる。",

	limit: {
		duration: HOUR,
		max: 300,
	},

	kind: "write:notes",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			createdNote: {
				type: "object",
				optional: false,
				nullable: false,
				ref: "Note",
				description: "作成された投稿。",
			},
		},
	},

	errors: {
		duplicateRequest: {
			message: "同じリクエストが短時間に送信されました。",
			code: "DUPLICATE_REQUEST",
			id: "8f1cbf7f-e932-47d5-a2bb-bddc877130af",
			httpStatusCode: 409,
		},

		idempotencyKeyConflict: {
			message: "Idempotency key がリクエスト本文とヘッダーで一致しません。",
			code: "IDEMPOTENCY_KEY_CONFLICT",
			id: "76090195-f1a3-44c0-95bc-e1db4f0a4d5f",
			httpStatusCode: 400,
		},

		noSuchRenoteTarget: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_RENOTE_TARGET",
			id: "b5c90186-4ab0-49c8-9bba-a1f76c282ba4",
		},

		cannotReRenote: {
			message: "You can not Renote a pure Renote.",
			code: "CANNOT_RENOTE_TO_A_PURE_RENOTE",
			id: "fd4cc33e-2a37-48dd-99cc-9b806eb2031a",
		},

		noSuchReplyTarget: {
			message: "そのreply targetは存在しません。",
			code: "NO_SUCH_REPLY_TARGET",
			id: "749ee0f6-d3da-459a-bf02-282e2da4292c",
		},

		cannotReplyToPureRenote: {
			message: "You can not reply to a pure Renote.",
			code: "CANNOT_REPLY_TO_A_PURE_RENOTE",
			id: "3ac74a84-8fd5-4bb0-870f-01804f82ce15",
		},

		cannotCreateNoChoicesPoll: {
			message: "投票には最低でも選択肢が1つ必要です。",
			code: "CANNOT_CREATE_NO_CHOICES_POLL",
			id: "08a88f84-118a-80ef-eb88-e2e1983ed74d",
		},

		cannotCreateAlreadyExpiredPoll: {
			message: "投票は既に終了しています。",
			code: "CANNOT_CREATE_ALREADY_EXPIRED_POLL",
			id: "04da457d-b083-4055-9082-955525eda5a5",
		},

		noSuchChannel: {
			message: "そのchannelは存在しません。",
			code: "NO_SUCH_CHANNEL",
			id: "b1653923-5453-4edc-b786-7c4f39bb0bbb",
		},

		youHaveBeenBlocked: {
			message: "あなたはこのユーザーからブロックされています。",
			code: "YOU_HAVE_BEEN_BLOCKED",
			id: "b390d7e1-8a5e-46ed-b625-06271cafd3d3",
		},

		appBlockPublic: {
			message:
				"アプリからの公開投稿を禁止されています。Webで行うか、ホーム以下の公開範囲に設定してください。",
			code: "APP_BLOCK_PUBLIC",
			id: "b390d7e1-8a5e-46ed-b625-06271cafd3d3",
		},

		accountLocked: {
			message: "移行しました。アカウントがロックされています。",
			code: "ACCOUNT_LOCKED",
			id: "d390d7e1-8a5e-46ed-b625-06271cafd3d3",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		visibility: {
			type: "string",
			enum: noteVisibilities,
			default: "public",
			description: "公開範囲（public / home / followers / specified のいずれか）。",
		},
		visibilityForce: {
			type: "boolean",
			default: false,
			description:
				"true のとき、公開範囲の自動変更を行わず指定した visibility をそのまま使う。チャンネル投稿の public 強制、ユーザー設定による変更、リノート・返信先への公開範囲の合わせは適用されない。",
		},
		visibleUserIds: {
			type: "array",
			uniqueItems: true,
			items: {
				type: "string",
				format: "misskey:id",
			},
			description:
				"公開範囲が specified のとき、見せるユーザー ID の配列。",
		},
		text: {
			type: "string",
			maxLength: MAX_NOTE_TEXT_LENGTH,
			nullable: true,
			description: "投稿本文。リノートのみの場合は省略可。",
		},
		cw: {
			type: "string",
			nullable: true,
			maxLength: 100,
			description: "内容警告（ネタバレ隠し）の文言。指定すると本文が折りたたまれる。",
		},
		localOnly: {
			type: "boolean",
			default: false,
			description: "true にすると連合に送信せず、ローカルのみに表示する。",
		},
		noExtractMentions: {
			type: "boolean",
			default: false,
			description: "true にすると本文から @メンションを自動抽出しない。",
		},
		noExtractHashtags: {
			type: "boolean",
			default: false,
			description: "true にすると本文から #ハッシュタグ を自動抽出しない。",
		},
		noExtractEmojis: {
			type: "boolean",
			default: false,
			description: "true にすると本文から :絵文字: を自動抽出しない。",
		},
		fileIds: {
			type: "array",
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: "string", format: "misskey:id" },
			description: "添付するドライブファイルの ID 配列。並び順はこの配列の順。",
		},
		mediaIds: {
			deprecated: true,
			description:
				"`fileIds` の代替。両方指定した場合はこの値は無視されます。",
			type: "array",
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			items: { type: "string", format: "misskey:id" },
		},
		replyId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "返信先投稿の ID。指定するとその投稿へのリプライになる。",
		},
		renoteId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "リノート元の投稿の ID。",
		},
		referenceIds: {
			type: "array",
			uniqueItems: true,
			minItems: 1,
			maxItems: 1000,
			items: { type: "string", format: "misskey:id" },
			description:
				"参照投稿の ID 配列。この配列だけ指定すると、それらを参照する投稿（引用なしの参照）になる。",
		},
		channelId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "投稿先チャンネルの ID。",
		},
		poll: {
			type: "object",
			nullable: true,
			description: "アンケートを付ける場合の設定。choices 必須。",
			properties: {
				choices: {
					type: "array",
					minItems: 1,
					maxItems: 20,
					items: { type: "string", minLength: 1, maxLength: 50 },
					description: "選択肢の文字列の配列。",
				},
				multiple: {
					type: "boolean",
					default: false,
					description: "複数選択を許可するか。",
				},
				hideResults: {
					type: "boolean",
					default: false,
					description: "終了まで結果を非表示にするか。",
				},
				expiresAt: {
					type: "integer",
					nullable: true,
					description: "締切日時（Unix ミリ秒）。",
				},
				expiredAfter: {
					type: "integer",
					nullable: true,
					minimum: 1,
					description: "投稿から何ミリ秒後に締め切るか。expiresAt と併用不可。",
				},
			},
			required: ["choices"],
		},
		fileUrls: {
			type: "array",
			nullable: true,
			uniqueItems: true,
			minItems: 1,
			maxItems: 16,
			description:
				"URL からドライブに取り込んで添付。要素は URL 文字列、または { url, folderId?, isSensitive?, comment?, marker?, force? }。",
			items: {
				anyOf: [
					{
						type: "string",
					},
					{
						type: "object",
						properties: {
							url: { type: "string", description: "取り込むファイルの URL。" },
							folderId: {
								type: "string",
								format: "misskey:id",
								nullable: true,
								description: "保存先フォルダ ID。",
							},
							isSensitive: {
								type: "boolean",
								description: "閲覧注意にするか。",
							},
							comment: {
								type: "string",
								nullable: true,
								maxLength: 512,
								description: "ファイルのコメント。",
							},
							marker: { type: "string", nullable: true },
							force: {
								type: "boolean",
								description: "既存ファイルを上書きして取り込むか。",
							},
						},
						required: ["url"],
					},
				],
			},
		},
		idempotencyKey: {
			type: "string",
			maxLength: 128,
			nullable: true,
			description:
				"冪等キー。同じキーで短時間に再送すると重複扱いで 409。ヘッダー idempotency-key でも指定可。",
		},
	},
	anyOf: [
		{
			// (リ)ノート：テキスト・ファイル・アンケートは任意
			properties: {
				text: {
					type: "string",
					minLength: 1,
					maxLength: MAX_NOTE_TEXT_LENGTH,
					nullable: false,
				},
			},
			required: ["text"],
		},
		{
			// (リ)ノート：ファイル指定時、テキスト・アンケートは任意
			required: ["fileIds"],
		},
		{
			// (リ)ノート：mediaIds 指定時、テキスト・アンケートは任意
			required: ["mediaIds"],
		},
		{
			// (リ)ノート：アンケート指定時、テキスト・ファイルは任意
			properties: {
				poll: { type: "object", nullable: false },
			},
			required: ["poll"],
		},
		{
			// 純粋リノート
			required: ["renoteId"],
		},
		{
			// 参照
			required: ["referenceIds"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, user, _token, _file, _cleanup, _ip, headers) => {
	const endpointStartedAt = Date.now();
	const bodyIdempotencyKey = normalizeIdempotencyKey(ps.idempotencyKey);
	const headerIdempotencyKey = normalizeIdempotencyKey(headers?.["idempotency-key"]);

	if (
		bodyIdempotencyKey != null &&
		headerIdempotencyKey != null &&
		bodyIdempotencyKey !== headerIdempotencyKey
	) {
		throw new ApiError(meta.errors.idempotencyKeyConflict);
	}

	const idempotencyKey = headerIdempotencyKey ?? bodyIdempotencyKey;
	if (idempotencyKey != null) {
		const redisKey = `notes:create:idempotency:${user.id}:${idempotencyKey}`;
		const setResult = await redisClient.set(
			redisKey,
			"1",
			"EX",
			NOTES_CREATE_IDEMPOTENCY_TTL_SEC,
			"NX",
		);

		if (setResult !== "OK") {
			throw new ApiError(meta.errors.duplicateRequest);
		}
	}

	if (user.movedToUri != null) throw new ApiError(meta.errors.accountLocked);
	if (!ps.web && user.isMiniSilenced && ps.visibility === "public") {
			throw new ApiError(meta.errors.appBlockPublic);
	}

	// 公開先ユーザー・CCユーザー・ファイル・リノート・チャンネル取得の初期並列 Promise
	const visibleUsersPromise = ps.visibleUserIds ? Users.findBy({ id: In(ps.visibleUserIds) }) : Promise.resolve([]);

	const ccUsersPromise = ps.ccUserIds && (ps.ccUserIds.length <= 1 || user.canInvite)
			? Users.findBy({ id: In(ps.ccUserIds), host: IsNull() })
			: Promise.resolve([]);

	const fileIds = ps.fileIds != null ? ps.fileIds : ps.mediaIds != null ? ps.mediaIds : null;

	const filesPromise = fileIds != null
			? DriveFiles.createQueryBuilder("file")
					.where("file.userId = :userId AND file.id IN (:...fileIds)", {
							userId: user.id,
							fileIds,
					})
					.orderBy('array_position(ARRAY[:...fileIds], "id"::text)')
					.setParameters({ fileIds })
					.getMany()
			: Promise.resolve([]);

	const channelPromise = ps.channelId != null
			? Channels.findOneBy({ id: ps.channelId }).then((channel) => {
					if (channel == null) {
							throw new ApiError(meta.errors.noSuchChannel);
					}
					return channel;
			})
			: Promise.resolve(null);

	const renotePromise = (async () => {
			let renote: Note | null = null;
			if (ps.renoteId != null) {
					renote = await getNote(ps.renoteId, user).catch((e) => {
							if (e.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
									throw new ApiError(meta.errors.noSuchRenoteTarget);
							throw e;
					});

					if (!renote) throw new ApiError(meta.errors.noSuchRenoteTarget);

					if (renote.renoteId && !renote.text && !renote.fileIds && !renote.hasPoll) {
							throw new ApiError(meta.errors.cannotReRenote);
					}

					if (renote.userId !== user.id) {
							const block = await Blockings.findOneBy({
									blockerId: renote.userId,
									blockeeId: user.id,
							});
							if (block) {
									throw new ApiError(meta.errors.youHaveBeenBlocked);
							}
					}
			}
			return renote;
	})();

	const referencePromises = ps.referenceIds?.length
			? ps.referenceIds.map(noteId => getNote(noteId, user).catch((e) => {
					return null;
			}).then((reference) => {
					if (reference?.renoteId && !reference.text && !reference.fileIds && !reference.hasPoll) {
						return null;
					}
					return reference;
			}))
			: [];

	const replyPromise = (async (): Promise<{ reply: Note | null; additionalCcUsers: User[] }> => {
			let reply: Note | null = null;
			let additionalCcUsers: User[] = [];
			if (ps.replyId != null) {
					// 返信を取得する
					reply = await getNote(ps.replyId, user).catch((e) => {
							if (e.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
									throw new ApiError(meta.errors.noSuchReplyTarget);
							throw e;
					});

					if (!reply) throw new ApiError(meta.errors.noSuchReplyTarget);

					if (reply.renoteId && !reply.text && !reply.fileIds && !reply.hasPoll) {
							throw new ApiError(meta.errors.cannotReplyToPureRenote);
					}

					if (reply.ccUserIds.length && ps.inheritCc) {
							const replyCc = [...reply.ccUserIds];
							if (!reply.ccUserIds.includes(reply.userId)) replyCc.push(reply.userId);
							const idsToFetch = replyCc.filter(
								(x) => !ps.ccUserIds || !ps.ccUserIds.includes(x),
							);
							if (idsToFetch.length > 0) {
									additionalCcUsers = await Users.findBy({
											id: In(idsToFetch),
											host: IsNull(),
									});
							}
					}

					// ブロック関係を確認する
					if (reply.userId !== user.id) {
							const block = await Blockings.findOneBy({
									blockerId: reply.userId,
									blockeeId: user.id,
							});
							if (block) {
									throw new ApiError(meta.errors.youHaveBeenBlocked);
							}
					}
			}
			return { reply, additionalCcUsers };
	})();

	let [visibleUsers, ccUsers, files, channel, renote, replyResult] = await Promise.all([
			visibleUsersPromise,
			ccUsersPromise,
			filesPromise,
			channelPromise,
			renotePromise,
			replyPromise,
			//Promise.all(referencePromises),
	]);

	const reply = replyResult.reply;
	if (replyResult.additionalCcUsers.length > 0) {
		ccUsers = [...ccUsers, ...replyResult.additionalCcUsers];
	}

	const choices = new Set()
	if (ps.poll) {
			if (ps.poll.choices?.length) {
				for (const choice of ps.poll.choices) {
					if (!choice || (typeof choice === "string" && !choice.trim().length)) continue;
					let _choice = choice;
					while (choices.has(_choice)){
						_choice += "\u200B"
					}
					choices.add(_choice)
				}
			}
			if (!choices.size) throw new ApiError(meta.errors.cannotCreateNoChoicesPoll)
		if (typeof ps.poll.expiresAt === "number") {
					if (ps.poll.expiresAt < Date.now()) {
							throw new ApiError(meta.errors.cannotCreateAlreadyExpiredPoll);
					}
			} else if (typeof ps.poll.expiredAfter === "number") {
					ps.poll.expiresAt = Date.now() + ps.poll.expiredAfter;
			}
	}

	const fileUrlsPromises = (files.length < 16 && ps.fileUrls?.length)
			? ps.fileUrls.map(async (url) => {
					try {
							let file: DriveFile | undefined;
							if (typeof url === "string") {
									if (url.trim()?.startsWith("http")) {
											file = await uploadFromUrl({ url: url.trim(), user });
									}
							} else {
									if (url.url.trim()?.startsWith("http")) {
											file = await uploadFromUrl({
													url: url.url.trim(),
													user,
													folderId: url?.folderId ?? undefined,
													sensitive: url?.isSensitive,
													force: url?.force,
													comment: url?.comment ?? undefined,
											});
									}
							}
							if (file) {
									const packedFile = await DriveFiles.pack(file, { self: true });
									publishMainStream(user.id, "urlUploadFinished", {
											marker: typeof url === "string" ? null : url.marker,
											file: packedFile,
									});
									return file;
							}
					} catch (e) {
							console.log(e?.message);
					}
					return null;
			}).filter(promise => promise !== null)
			: [];

	const fileUrls = await Promise.all(fileUrlsPromises);
	files.push(...(fileUrls.filter((x) => x != null)));
	const endpointPreprocessMs = Date.now() - endpointStartedAt;

	// 投稿を作成する
	try {
			const note = await create(user, {
					createdAt: new Date(),
					files: files,
					poll: ps.poll
							? {
									choices: Array.from(choices),
									multiple: ps.poll.multiple,
									expiresAt: ps.poll.expiresAt ? new Date(ps.poll.expiresAt) : null,
									hideResults: ps.poll.hideResults ?? false,
							}
							: undefined,
					text: ps.text || undefined,
					reply,
					renote,
					references: ps.referenceIds?.length ? ps.referenceIds : undefined,
					cw: ps.cw,
					localOnly: ps.localOnly,
					visibility: ps.visibility,
			  	visibilityForce: ps.visibilityForce,
					visibleUsers,
					ccUsers,
					channel,
					apMentions: ps.noExtractMentions ? [] : undefined,
					apHashtags: ps.noExtractHashtags ? [] : undefined,
					apEmojis: ps.noExtractEmojis ? [] : undefined,
					endpointPreprocessMs,
			});
			return {
					createdNote: await Notes.pack(note, user),
			};
        } catch (e) {
                        if (e instanceof ApiError) throw e;

                        const statusError = e instanceof StatusError ? e : null;
                        const message =
                                        typeof e === "string"
                                                ? e
                                                : e instanceof Error
                                                ? e.message
                                                : "unknown error.";

                        throw new ApiError(
                                        {
                                                        message,
                                                        code: "NOTE_CREATE_ERROR",
                                                        id: "d390d7e1-8a5e-46ed-b625-06271cafd3d4",
                                                        ...(statusError
                                                                        ? {
                                                                                        httpStatusCode:
                                                                                                statusError.statusCode,
                                                                                        kind: statusError.isClientError
                                                                                                ? "client"
                                                                                                : "server",
                                                                                }
                                                                        : {}),
                                        },
                                        e instanceof Error ? e : undefined,
                        );
        }
});
