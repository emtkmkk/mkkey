/**
 * @packageDocumentation
 *
 * Webhook 配信ジョブ。イベントを Webhook URL に POST し、Discord 等の埋め込み形式を生成する。
 *
 * @remarks
 * - **役割**: Webhook キューで実行し、ノート作成等のイベントを登録 URL に POST する。
 *
 * @see {@link server/api/endpoints/i/update} Webhook 設定
 * @internal
 */
import { URL } from "node:url";
import type Bull from "bull";
import Logger from "@/services/logger.js";
import type { WebhookDeliverJobData } from "../types.js";
import { getResponse, StatusError } from "@/misc/fetch.js";
import { Users, Webhooks } from "@/models/index.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import config from "@/config/index.js";
import {
	resolveMessagingEmbedImageUrl,
	resolveMessagingThumbnailUrl,
	resolveNoteDiscordEmbedImage,
	resolveNoteDiscordEmbedVideo,
	resolveNoteEmbedImageUrl,
	resolveNoteThumbnailUrl,
} from "@/misc/notification-display-media.js";
import {
	excludeNotPlain,
	getDisplayFullUsername,
	getDisplayUsername,
	resolveWebhookTypeToBodyContent,
} from "@/misc/notification-display-text.js";

const logger = new Logger("webhook");

interface DiscordEmbeds {
	title?: String;
	type?: String;
	description?: String;
	url?: String;
	timestamp?: any;
	color?: number;
	footer?: {
		text: string;
		icon_url?: string;
		proxy_icon_url?: string;
	};
	image?: any;
	thumbnail?: {
		url: string;
		proxy_url?: string;
		height?: number;
		width?: number;
	};
	video?: any;
	provider?: any;
	author?: {
		name: string;
		url?: string;
		icon_url?: string;
		proxy_icon_url?: string;
	};
	fields?: Array<any>;
}

async function toDiscordEmbeds(
	body: any,
): Promise<(DiscordEmbeds | undefined)[] | undefined> {
	const meta = await fetchMeta();
	const defaultReaction = meta.defaultReaction;
	const normalizedNoteUser = await resolveUserForWebhook(body.note?.user);
	const normalizedMessageUser = await resolveUserForWebhook(body.message?.user);
	return [
		body.note
			? {
					author: {
						name: getDisplayUsername(normalizedNoteUser) ?? "",
						url: `${config.url}/@${normalizedNoteUser?.username}${
							normalizedNoteUser?.host ? `@${normalizedNoteUser?.host}` : ""
						}`,
						icon_url:
							normalizedNoteUser?.avatarUrl ?? body.note.user?.avatarUrl,
					},
					title: `投稿${
						body.note.visibility === "home"
							? " : 🏠ホーム"
							: body.note.visibility === "followers"
							? " : 🔒フォロワー限定"
							: body.note.visibility === "specified"
							? " : ✉ダイレクト"
							: ""
					}`,
					url: `${config.url}/notes/${body.note.id}`,
					description:
						(excludeNotPlain(getNoteSummary(body.note))?.length ?? 0) > 100
							? `${excludeNotPlain(getNoteSummary(body.note))?.slice(0, 100)}…${
									body.note.cw != null &&
									(excludeNotPlain(getNoteSummary(body.note))?.length ?? 0) >
										102
										? " (CW)"
										: ""
							  }`
							: excludeNotPlain(getNoteSummary(body.note)),
					timestamp: new Date(body.note.createdAt),
					image: resolveNoteDiscordEmbedImage(body.note),
					video: resolveNoteDiscordEmbedVideo(body.note),
					thumbnail: {
						url: resolveNoteThumbnailUrl(
							body.note,
							{
								reaction: body.reaction?.emojiName,
								customEmoji: body.reaction?.customEmoji,
								defaultReaction,
							},
							normalizedNoteUser?.avatarUrl ?? body.note.user?.avatarUrl,
						),
					},
					color: 16757683,
			  }
			: undefined,
		body.user
			? {
					title: `${body.user.isLocked ? "🔒 " : ""}${
						body.user.name
							? `${excludeNotPlain(body.user.name)} (${body.user.username}${
									body.user.host ? `@${body.user.host}` : ""
							  })`
							: `${body.user.username}${
									body.user.host ? `@${body.user.host}` : ""
							  }`
					}`,
					url: `${config.url}/@${body.user.username}${
						body.user.host ? `@${body.user.host}` : ""
					}`,
					description: excludeNotPlain(body.user.description) ?? undefined,
					fields: body.user.notesCount
						? [
								{
									name: "投稿数",
									value: body.user.notesCount,
								},
								{
									name: "フォロー",
									value: body.user.followingCount ?? "N/A",
								},
								{
									name: "フォロワー",
									value: body.user.followersCount ?? "N/A",
								},
						  ]
						: undefined,
					thumbnail: body.user.avatarUrl
						? {
								url: body.user.avatarUrl,
						  }
						: undefined,
					image: body.user.bannerUrl
						? {
								url: body.user.bannerUrl,
						  }
						: undefined,
					color: 16757683,
			  }
			: undefined,
		body.message
			? {
					author: {
						name: getDisplayUsername(normalizedMessageUser) ?? "",
						url: `${config.url}/@${normalizedMessageUser?.username}${
							normalizedMessageUser?.host
								? `@${normalizedMessageUser?.host}`
								: ""
						}`,
						icon_url:
							normalizedMessageUser?.avatarUrl ?? body.message.user?.avatarUrl,
					},
					title: `${
						body.message.group ? `${body.message.group.name} の` : "個人宛の"
					}チャット`,
					url: body.message.groupId
						? `${config.url}/my/messaging/group/${body.message.groupId}`
						: `${config.url}/my/messaging/${
								normalizedMessageUser?.username +
								(normalizedMessageUser?.host
									? `@${normalizedMessageUser?.host}`
									: "")
						  }`,
					description:
						((excludeNotPlain(body.message.text)?.length ?? 0) > 100
							? `${excludeNotPlain(body.message.text)?.slice(0, 100)}… `
							: excludeNotPlain(body.message.text) ?? "") +
						(body.message.file ? "(📎)" : ""),
					image: (() => {
						const url = resolveMessagingEmbedImageUrl(body.message);
						const file = body.message.file;
						return url != null && file != null
							? {
									url,
									height: file.properties?.height,
									width: file.properties?.width,
							  }
							: undefined;
					})(),
					video:
						body.message.file &&
						!body.message.file.isSensitive &&
						(body.message.file.type?.toLowerCase().startsWith("video") ||
							body.message.file.type?.toLowerCase().startsWith("audio"))
							? {
									url: body.message.file.url,
									height: body.message.file.properties?.height,
									width: body.message.file.properties?.width,
							  }
							: undefined,
					timestamp: new Date(body.message.createdAt),
					thumbnail: {
						url: resolveMessagingThumbnailUrl(
							body.message,
							body.emoji?.publicUrl,
							normalizedMessageUser?.avatarUrl ??
								body.message.user?.avatarUrl,
						),
					},
					color: 16757683,
			  }
			: undefined,
	].filter((x) => x !== undefined);
}

async function toSlackEmbeds(data: any): Promise<any[]> {
	const meta = await fetchMeta();
	const content = await typeToBody(data);
	const body = data.content;
	const normalizedNoteUser = await resolveUserForWebhook(body.note?.user);
	const normalizedMessageUser = await resolveUserForWebhook(body.message?.user);
	return [
		body.note
			? {
					author_name: getDisplayUsername(normalizedNoteUser),
					author_link: `${config.url}/@${normalizedNoteUser?.username}${
						normalizedNoteUser?.host ? `@${normalizedNoteUser?.host}` : ""
					}`,
					author_icon:
						normalizedNoteUser?.avatarUrl ?? body.note.user?.avatarUrl,
					icon_url: content.avatar_url,
					username: content.username,
					fallback: emojiEscape(content.content),
					pretext: emojiEscape(content.content),
					title: `投稿${
						body.note.visibility === "home"
							? " : 🏠ホーム"
							: body.note.visibility === "followers"
							? " : 🔒フォロワー限定"
							: body.note.visibility === "specified"
							? " : ✉ダイレクト"
							: ""
					}`,
					text: emojiEscape(
						(excludeNotPlain(getNoteSummary(body.note))?.length ?? 0) > 100
							? `${excludeNotPlain(getNoteSummary(body.note))?.slice(0, 100)}…${
									body.note.cw != null &&
									(excludeNotPlain(getNoteSummary(body.note))?.length ?? 0) >
										102
										? " (CW)"
										: ""
							  }`
							: excludeNotPlain(getNoteSummary(body.note)),
					),
					title_link: `${config.url}/notes/${body.note.id}`,
					color: "#f8bcba",
					ts: new Date(body.note.createdAt).valueOf() / 1000,
					image_url: resolveNoteEmbedImageUrl(body.note),
					thumb_url: resolveNoteThumbnailUrl(
						body.note,
						{
							reaction: body.reaction?.emojiName,
							customEmoji: body.reaction?.customEmoji,
							defaultReaction: meta.defaultReaction,
						},
						normalizedNoteUser?.avatarUrl ?? body.note.user?.avatarUrl,
					),
					footer: meta.name || "Calckey",
					footer_icon: meta.iconUrl || undefined,
			  }
			: undefined,
		body.user
			? {
					title:
						(body.user.isLocked ? "🔒 " : "") +
						(body.user.name
							? `${excludeNotPlain(body.user.name)} (${body.user.username}${
									body.user.host ? `@${body.user.host}` : ""
							  })`
							: body.user.username +
							  (body.user.host ? `@${body.user.host}` : "")),
					title_link: `${config.url}/@${body.user.username}${
						body.user.host ? `@${body.user.host}` : ""
					}`,
					text:
						emojiEscape(excludeNotPlain(body.user.description)) ?? undefined,
					icon_url: content.avatar_url,
					username: content.username,
					fallback: emojiEscape(content.content),
					pretext: emojiEscape(content.content),
					fields: body.user.notesCount
						? [
								{
									title: "投稿数",
									value: body.user.notesCount,
								},
								{
									title: "フォロー",
									value: body.user.followingCount ?? "N/A",
								},
								{
									title: "フォロワー",
									value: body.user.followersCount ?? "N/A",
								},
						  ]
						: undefined,
					image_url: body.user.bannerUrl ? body.user.bannerUrl : undefined,
					thumb_url: body.user.avatarUrl ? body.user.avatarUrl : undefined,
					color: meta.themeColor || "#f8bcba",
					footer: meta.name || "Calckey",
					footer_icon: meta.iconUrl || undefined,
			  }
			: undefined,
		body.message
			? {
					author_name: getDisplayUsername(normalizedMessageUser),
					author_link: `${config.url}/@${normalizedMessageUser?.username}${
						normalizedMessageUser?.host
							? `@${normalizedMessageUser?.host}`
							: ""
					}`,
					author_icon:
						normalizedMessageUser?.avatarUrl ?? body.message.user?.avatarUrl,
					icon_url: content.avatar_url,
					username: content.username,
					fallback: emojiEscape(content.content),
					pretext: emojiEscape(content.content),
					title: `${
						body.message.group ? `${body.message.group.name} の` : "個人宛の"
					}チャット`,
					title_link: body.message.groupId
						? `${config.url}/my/messaging/group/${body.message.groupId}`
						: `${config.url}/my/messaging/${
								normalizedMessageUser?.username +
								(normalizedMessageUser?.host
									? `@${normalizedMessageUser?.host}`
									: "")
						  }`,
					text: emojiEscape(
						((excludeNotPlain(body.message.text)?.length ?? 0) > 100
							? `${excludeNotPlain(body.message.text)?.slice(0, 100)}… `
							: excludeNotPlain(body.message.text) ?? "") +
							(body.message.file ? "(📎)" : ""),
					),
					image_url: resolveMessagingEmbedImageUrl(body.message),
					ts: new Date(body.message.createdAt).valueOf() / 1000,
					thumb_url: resolveMessagingThumbnailUrl(
						body.message,
						body.emoji?.publicUrl,
						normalizedMessageUser?.avatarUrl ??
							body.message.user?.avatarUrl,
					),
					color: meta.themeColor || "#f8bcba",
					footer: meta.name || "Calckey",
					footer_icon: meta.iconUrl || undefined,
			  }
			: undefined,
	].filter((x) => x !== undefined);
}

function emojiEscape(text?: string): string | undefined {
	// 絵文字をエスケープする
	return text ? text.replaceAll(/:(\w+):/g, "：$1：") : undefined;
}

async function resolveUserForWebhook(user?: any): Promise<any | undefined> {
	if (!user) {
		return undefined;
	}

	if (typeof user === "object" && typeof user.username === "string") {
		return user;
	}

	const userId = typeof user === "string" ? user : user.id;
	if (typeof userId !== "string") {
		return user;
	}

	const resolved = await Users.findOneBy({ id: userId });
	if (!resolved) {
		return user;
	}

	return {
		id: resolved.id,
		name: resolved.name,
		username: resolved.username,
		host: resolved.host,
		avatarUrl: Users.getAvatarUrlSync(resolved),
	};
}

function getNoteContentSummary(
	note: any,
	userId: string,
	textLength?: number,
): string | undefined {
	const noteText = excludeNotPlain(getNoteSummary(note));
	return noteText
		? textLength
			? noteText.slice(0, textLength) +
			  (noteText?.length > textLength ? "…" : "")
			: note.user?.id === userId
			? noteText.slice(0, 10) + (noteText?.length > 10 ? "…" : "")
			: noteText.slice(0, 40) + (noteText?.length > 40 ? "…" : "")
		: undefined;
}

async function typeToBody(jobData: any): Promise<any> {
	const meta = await fetchMeta();
	const defaultReaction = meta.defaultReaction;
	const body = jobData.content;
	const contentLength =
		jobData.secret?.replaceAll("Discord", "").replaceAll("Slack", "") ||
		undefined;

	const user = body.user
		? body.user
		: body.antenna
		? body.antenna.noteUser
		: body.reaction
		? body.reaction.user
		: body.note
		? body.note.user
		: body.message
		? body.message.user
		: undefined;
	const normalizedUser = await resolveUserForWebhook(user);
	const normalizedNoteUser = await resolveUserForWebhook(body.note?.user);
	const username = getDisplayUsername(normalizedUser);
	const fullUsername = getDisplayFullUsername(normalizedUser);
	const avatar_url = normalizedUser
		? normalizedUser.avatarUrl ?? (await Users.getAvatarUrl(normalizedUser))
		: undefined;

	const content =
		contentLength !== 0
			? body.note
				? ` : ${getNoteContentSummary(
						body.note.text ? body.note : body.note.renote,
						jobData.userId,
						contentLength,
				  )}`
				: body.message?.text
				? ` : ${excludeNotPlain(body.message.text)?.slice(
						0,
						contentLength ?? 40,
				  )}${
						(excludeNotPlain(body.message.text)?.length ?? 0) > contentLength ??
						40
							? "…"
							: ""
				  }`
				: ""
			: "";

	const rtPrefix =
		normalizedUser?.id !== normalizedNoteUser?.id
			? ` : RT ${getDisplayUsername(normalizedNoteUser)}`
			: "";

	return {
		username,
		avatar_url,
		content: resolveWebhookTypeToBodyContent(jobData.type, {
			username,
			fullUsername,
			noteExcerptSuffix: content,
			reactionEmojiName: body.reaction?.emojiName,
			antennaName: body.antenna?.name,
			groupName: body.message?.group?.name,
			noteHasText: Boolean(body.note?.text),
			defaultReaction,
			rtPrefix,
		}),
	};
}

export default async (job: Bull.Job<WebhookDeliverJobData>) => {
	try {
		logger.info(`Webhook ${job.data.webhookId}`);
		job.log("info - " + `Webhook ${job.data.webhookId}`);
		logger.debug(`delivering ${job.data.webhookId}`);
		job.log("debug - " + `delivering ${job.data.webhookId}`);
		let res;
		if (job.data.secret?.startsWith("Discord")) {
			let embeds = await toDiscordEmbeds(job.data.content);
			res = await getResponse({
				url: job.data.to,
				method: "POST",
				headers: {
					"User-Agent": "Calckey-Hooks",
					"X-Calckey-Host": config.host,
					"X-Calckey-Hook-Id": job.data.webhookId,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...(await typeToBody(job.data)),
					embeds,
				}),
			});
		} else if (job.data.secret?.startsWith("Slack")) {
			let attachments = await toSlackEmbeds(job.data);
			res = await getResponse({
				url: job.data.to,
				method: "POST",
				headers: {
					"User-Agent": "Calckey-Hooks",
					"X-Calckey-Host": config.host,
					"X-Calckey-Hook-Id": job.data.webhookId,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					attachments,
				}),
			});
		} else {
			res = await getResponse({
				url: job.data.to,
				method: "POST",
				headers: {
					"User-Agent": "Calckey-Hooks",
					"X-Calckey-Host": config.host,
					"X-Calckey-Hook-Id": job.data.webhookId,
					"X-Calckey-Hook-Secret": job.data.secret,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					hookId: job.data.webhookId,
					userId: job.data.userId,
					eventId: job.data.eventId,
					createdAt: job.data.createdAt,
					type: job.data.type,
					body: job.data.content,
				}),
			});
		}

		Webhooks.update(
			{ id: job.data.webhookId },
			{
				latestSentAt: new Date(),
				latestStatus: res.status,
			},
		);

		job.progress(100);
		return "Success";
	} catch (res) {
		Webhooks.update(
			{ id: job.data.webhookId },
			{
				latestSentAt: new Date(),
				latestStatus: res instanceof StatusError ? res.statusCode : 1,
			},
		);

		if (res instanceof StatusError) {
			// 4xx
			if (!res.isRetryable) {
				return `${res.statusCode} ${res.statusMessage}`;
			}

			// 5xx etc.
			throw new Error(`${res.statusCode} ${res.statusMessage}`);
		} else {
			// DNS error, socket error, timeout ...
			throw res;
		}
	}
};
