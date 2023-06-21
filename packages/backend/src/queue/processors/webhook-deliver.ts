import { URL } from "node:url";
import type Bull from "bull";
import Logger from "@/services/logger.js";
import type { WebhookDeliverJobData } from "../types.js";
import { getResponse, StatusError } from "@/misc/fetch.js";
import { Users, Webhooks } from "@/models/index.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";
import config from "@/config/index.js";

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

function toEmbeds(body: any): Array<DiscordEmbeds> {
	return [
		body.note ? ({
			author: {
				name: getUsername(body.note.user),
				url: "https://mkkey.net/@" + body.note.user?.username + (body.note.user?.host ? "@" + body.note.user?.host : ""),
				icon_url: body.note.user?.avatarUrl,
			},
			title: "投稿" + (body.note.visibility === "home" ? " : 🏠ホーム" : body.note.visibility === "followers" ? " : 🔒フォロワー限定" : body.note.visibility === "specified" ? " : ✉ダイレクト" : ""),
			url: "https://mkkey.net/notes/" + body.note.id,
			description: excludeNotPlain(getNoteSummary(body.note)).length > 100 ? excludeNotPlain(getNoteSummary(body.note)).slice(0, 100) + "…" + (body.note.cw != null && excludeNotPlain(getNoteSummary(body.note)).length > 102 ? " (CW)" : "") : excludeNotPlain(getNoteSummary(body.note)),
			timestamp: new Date(body.note.createdAt),
			image: body.note.files?.length > 0 && !body.note.cw && !body.note.files[0].isSensitive && body.note.files[0].type?.toLowerCase().startsWith("image") ?
				{
					url: body.note.files[0].url,
					height: body.note.files[0].properties?.height,
					width: body.note.files[0].properties?.width,
				} : undefined,
			video: body.note.files?.length > 0 && !body.note.cw && !body.note.files[0].isSensitive && (body.note.files[0].type?.toLowerCase().startsWith("video") || body.note.files[0].type?.toLowerCase().startsWith("audio")) ?
				{
					url: body.note.files[0].url,
					height: body.note.files[0].properties?.height,
					width: body.note.files[0].properties?.width,
				} : undefined,
			thumbnail: {
				url: body.reaction?.customEmoji ? body.reaction?.customEmoji.publicUrl : (body.note.files?.length > 1 && !body.note.cw && !body.note.files[1].isSensitive && body.note.files[1].type?.startsWith("image")) ? body.note.files[1].thumbnailUrl : body.note.user?.avatarUrl,
			},
			color: 16757683,
		}) : undefined,
		body.user ? ({
			title: (body.user.isLocked ? "🔒 " : "") + (body.user.name ? (excludeNotPlain(body.user.name) + " (" + body.user.username + (body.user.host ? "@" + body.user.host : "") + ")") : (body.user.username + (body.user.host ? "@" + body.user.host : ""))),
			url: "https://mkkey.net/@" + body.user.username + (body.user.host ? "@" + body.user.host : ""),
			description: excludeNotPlain(body.user.description) ?? undefined,
			fields: body.user.notesCount ? [
				{
					name: "投稿数",
					value: body.user.notesCount
				},
				{
					name: "フォロー",
					value: body.user.followingCount ?? "N/A"
				},
				{
					name: "フォロワー",
					value: body.user.followersCount ?? "N/A"
				},
			] : undefined,
			thumbnail: body.user.avatarUrl ? {
				url: body.user.avatarUrl,
			} : undefined,
			image: body.user.bannerUrl ?
				{
					url: body.user.bannerUrl,
				} : undefined,
			color: 16757683,
		}) : undefined,
		body.message ? ({
			author: {
				name: getUsername(body.message.user),
				url: "https://mkkey.net/@" + body.message.user?.username + (body.message.user?.host ? "@" + body.message.user?.host : ""),
				icon_url: body.message.user?.avatarUrl,
			},
			title: (body.message.group ? body.message.group.name + " の" : "個人宛の") + "チャット",
			url: body.message.groupId ? "https://mkkey.net/my/messaging/group/" + body.message.groupId : "https://mkkey.net/my/messaging/" + (body.message.user?.username + (body.message.user?.host ? "@" + body.message.user?.host : "")),
			description: (excludeNotPlain(body.message.text)?.length > 100 ? excludeNotPlain(body.message.text)?.slice(0, 100) + "… " : excludeNotPlain(body.message.text) ?? "") + (body.message.file ? "(📎)" : ""),
			image: body.message.file && !body.message.file.isSensitive && body.message.file.type?.toLowerCase().startsWith("image") ?
				{
					url: body.message.file.url,
					height: body.message.file.properties?.height,
					width: body.message.file.properties?.width,
				} : undefined,
			video: body.message.file && !body.message.file.isSensitive && (body.message.file.type?.toLowerCase().startsWith("video") || body.message.file.type?.toLowerCase().startsWith("audio")) ?
				{
					url: body.message.file.url,
					height: body.message.file.properties?.height,
					width: body.message.file.properties?.width,
				} : undefined,
			timestamp: new Date(body.message.createdAt),
			thumbnail: {
				url: body.emoji ? body.emoji.publicUrl : body.message.file && !body.message.file.isSensitive && body.message.file.type?.toLowerCase().startsWith("video") ? body.message.file.thumbnailUrl : body.message.user?.avatarUrl,
			},
			color: 16757683,
		}) : undefined,
	].filter((x: DiscordEmbeds | undefined) => x !== undefined)
}

function excludeNotPlain(text): string {
	// 絵文字を外す、<xxx>を消す、中身が空のMFMを消す（4階層まで）
	return text ? text.replaceAll(/<\/?\w*?>/g, '').replaceAll(/(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*\])?\s*\])?\s*\])?\s*\])/g, '') : undefined;
}

function getUsername(user): string {
	return user ? user.name?.replaceAll(/ ?:.*?:/g, '') || user.username : undefined;
}

function getNoteContentSummary(note, userId, length?): string {
	const noteText = excludeNotPlain(getNoteSummary(note));
	return (
		length
			? noteText.slice(0, length) + (noteText.length > length ? "…" : "")
			: note.user?.id === userId
				? noteText.slice(0, 10) + (noteText.length > 10 ? "…" : "")
				: noteText.slice(0, 40) + (noteText.length > 40 ? "…" : "")
	)
}

async function typeToBody(jobData: any): Promise<any> {
	const body = jobData.content;
	const contentLength = jobData.secret?.replaceAll("Discord", "") || undefined;

	const user = body.user ? body.user : body.antenna ? body.antenna.noteUser : body.reaction ? body.reaction.user : body.note ? body.note.user : body.message ? body.message.user : undefined;
	const username = user ? getUsername(user) : undefined;
	const fullUsername = user ? user.name ? user.name + " (" + user.username + "@" + (user.host ?? "mkkey.net") + ")" : user.username + "@" + (user.host ?? "mkkey.net") : undefined;
	const avatar_url = user ? user.avatarUrl ?? (await Users.findOneByOrFail({ id: user.id }))?.avatarUrl : undefined;

	const content =
		contentLength !== 0
			? body.note
				? " : " + getNoteContentSummary(body.note.text ? body.note : body.note.renote, jobData.userId, contentLength)
				: body.message?.text
					? " : " + excludeNotPlain(body.message.text).slice(0, contentLength ?? 40) + (excludeNotPlain(body.message.text).length > contentLength ?? 40 ? "…" : "")
					: ""
			: "";

	switch (jobData.type) {
		case "mention":
			return {
				username,
				avatar_url,
				content: "呼びかけ" + content,
			};
		case "unfollow":
			return {
				fullUsername,
				avatar_url,
				content: "リムーブされました",
			};
		case "silentUnfollow":
			return {
				fullUsername,
				avatar_url,
				content: "💬 リムーブされました",
			};
		case "follow":
			return {
				fullUsername,
				avatar_url,
				content: "フォローに成功",
			};
		case "followed":
			return {
				fullUsername,
				avatar_url,
				content: "フォローされました",
			};
		case "note":
			return {
				content: "投稿に成功しました" + content,
			};
		case "reply":
			return {
				username,
				avatar_url,
				content: "返信" + content,
			};
		case "renote":
			return {
				username,
				avatar_url,
				content: (body.note.text ? "引用" : "RT") + content,
			};
		case "reaction":
			return {
				username,
				avatar_url,
				content: body.reaction?.emojiName + content,
			};
		case "antenna":
			return {
				username,
				avatar_url,
				content: body.antenna?.name + "📡新着" + (user.id !== body.note?.user?.id ? " RT " + getUsername(body.note?.user) : "") + content,
			};
		case "userMessage":
			return {
				username,
				avatar_url,
				content: "個別チャット" + content,
			};
		case "groupMessage":
			return {
				username,
				avatar_url,
				content: body.message.group.name + " でのチャット" + content,
			};
		default:
			return {
				content: "type : " + jobData.type + content,
			};
	}
}

export default async (job: Bull.Job<WebhookDeliverJobData>) => {
	try {
		logger.debug(`delivering ${job.data.webhookId}`);
		let res;
		let embeds = toEmbeds(job.data.content);
		if (job.data.secret?.startsWith("Discord")) {
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
					...await typeToBody(job.data),
					embeds,
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
			if (res.isClientError) {
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