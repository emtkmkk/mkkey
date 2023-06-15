import { URL } from "node:url";
import type Bull from "bull";
import Logger from "@/services/logger.js";
import type { WebhookDeliverJobData } from "../types.js";
import { getResponse, StatusError } from "@/misc/fetch.js";
import { Webhooks } from "@/models/index.js";
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
				name: body.note.user?.name || body.note.user?.username,
				url: "https://mkkey.net/@" + body.note.user?.username + (body.note.user?.host ? "@" + body.note.user?.host : ""),
				icon_url: body.note.user?.avatarUrl,
			},
			title: "投稿" + (body.note.visibility === "home" ? " : ホーム" : body.note.visibility === "followers" ? " : フォロワー限定" : body.note.visibility === "specified" ? " : ダイレクト" : ""),
			url: "https://mkkey.net/notes/" + body.note.id,
			description: getNoteSummary(body.note).length > 100 ? getNoteSummary(body.note).slice(0,100) + "…" + (body.note.cw != null && getNoteSummary(body.note).length > 102 ? " (CW)" : "") : getNoteSummary(body.note),
			timestamp: new Date(body.note.createdAt),
			image: body.note.files?.length > 0 && !body.note.cw && !body.note.files[0].isSensitive ? 
			    {
					url: body.note.files[0].thumbnailUrl,
					height: body.note.files[0].properties?.height,
					width: body.note.files[0].properties?.width,
				} : undefined,
			thumbnail: {
				url: body.reaction?.customEmoji ? body.reaction?.customEmoji.publicUrl : (body.note.files?.length > 1 && !body.note.cw && !body.note.files[1].isSensitive) ? body.note.files[1].thumbnailUrl : body.note.user?.avatarUrl,
			},
			color: 16757683,
		}) : undefined,
		body.user ? ({
			title: "ユーザ",
			url: "https://mkkey.net/@" + body.user.username + (body.user.host ? "@" + body.user.host : ""),
			description: body.user.name ? (body.user.name + " (" + body.user.username + (body.user.host ? "@" + body.user.host : "") + ")") : (body.user.username + (body.user.host ? "@" + body.user.host : "")),
			thumbnail: {
				url: body.user.avatarUrl,
			},
			color: 16757683,
		}) : undefined,
		body.message ? ({
			author: {
				name: body.message.user?.name || body.message.user?.username,
				url: "https://mkkey.net/@" + body.message.user?.username + (body.message.user?.host ? "@" + body.message.user?.host : ""),
				icon_url: body.message.user?.avatarUrl,
			},
			title: (body.message.group ? body.message.group.name + " グループでの" : "個人宛の") + "チャット",
			url: body.message.groupId ? "https://mkkey.net/my/messaging/group/" + body.message.groupId : "https://mkkey.net/my/messaging/" + (body.message.user?.username + (body.message.user?.host ? "@" + body.message.user?.host : "")),
			description: body.message.text?.length > 100 ? body.message.text?.slice(0,100) + "…" : body.message.text ?? "",
			image: body.message.file && !body.message.file.isSensitive ? 
			    {
					url: body.message.file.thumbnailUrl,
					height: body.message.file.properties?.height,
					width: body.message.file.properties?.width,
				} : undefined,
			timestamp: new Date(body.message.createdAt),
			thumbnail: {
				url: body.emoji ? body.emoji.publicUrl : body.message.user?.avatarUrl,
			},
			color: 16757683,
		}) : undefined,
	].filter((x: DiscordEmbeds | undefined) => x !== undefined)
}

function getNoteContentSummary(note,userId): string {
	return (
		note.user?.id === userId 
			? getNoteSummary(note).slice(0,10) + (getNoteSummary(note).length > 10 ? "…" : "") 
			: getNoteSummary(note).slice(0,40) + (getNoteSummary(note).length > 40 ? "…" : "")
	) 
}

function typeToContent(jobData: any): string {
	const body = jobData.content;
	
	const noteUser = body.note ? (body.note.user?.name || body.note.user?.username) : undefined;
	const userName = body.user ? body.user.name ? body.user.name + " (" + body.user.username + "@" + (body.user.host ?? "mkkey.net") + ")" : body.user.username + "@" + (body.user.host ?? "mkkey.net") : undefined;
	const reactionUser = body.reaction ? (body.reaction.user?.name || body.reaction.user?.username) : undefined;
	const antennaNoteUser = body.antenna ? (body.antenna.noteUser?.name || body.antenna.noteUser?.username) : undefined;
	const messageUser = body.message ? (body.message.user?.name || body.message.user?.username) : undefined;
	
	const content = 
		body.note 
			? " : " + getNoteContentSummary(body.note.text ? body.note : body.note.renote, jobData.userId)
			: body.message?.text 
				?  " : " + body.message.text.slice(0,40) + (body.message.text.length > 40 ? "…" : "") 
				: "";
							
	switch (jobData.type) {
		case "mention":
			return noteUser + " からの呼びかけ" + content;
		case "unfollow":
			return userName + " からリムーブされました"
		case "follow":
			return userName + " のフォローに成功"
		case "followed":
			return userName + " からフォローされました"
		case "note":
			return "投稿に成功しました" + content;
		case "reply":
			return noteUser + " からの返信" + content;
		case "renote":
			return noteUser + " からの" + (body.note.text ? "引用" : "RT") + content;
		case "reaction":
			return body.reaction?.emojiName + " " + reactionUser + " から" + content;
		case "antenna":
			return body.antenna?.name + "📡新着 " + antennaNoteUser + " から" + content;
		case "userMessage":
			return messageUser + " からのメッセージ" + content;
		case "groupMessage":
			return body.message.group.name + " グループで " + messageUser + " からのメッセージ" + content;
	}
}

export default async (job: Bull.Job<WebhookDeliverJobData>) => {
	try {
		logger.debug(`delivering ${job.data.webhookId}`);
		let res;
		let embeds = toEmbeds(job.data.content);
		if (job.data.secret === "Discord"){
			res = await getResponse({
				url: job.data.to,
				method: "POST",
				headers: {
					"User-Agent": "Calckey-Hooks",
					"X-Calckey-Host": config.host,
					"X-Calckey-Hook-Id": job.data.webhookId,
					"Content-Type": "application/json",
				},
				body: embeds.length !== 0 ? JSON.stringify({
					content: typeToContent(job.data),
					embeds,
				}) : JSON.stringify({
					content: job.data.type,
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
