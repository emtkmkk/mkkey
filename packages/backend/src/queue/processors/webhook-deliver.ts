import { URL } from "node:url";
import type Bull from "bull";
import Logger from "@/services/logger.js";
import type { WebhookDeliverJobData } from "../types.js";
import { getResponse, StatusError } from "@/misc/fetch.js";
import { Webhooks } from "@/models/index.js";
import config from "@/config/index.js";

const logger = new Logger("webhook");

function toEmbeds(body: any) {
	return [
	body.note ? {
   		author: {
			name: body.note.user?.name || body.note.user?.username,
			url: "https://mkkey.net/@" + body.note.user?.username + (body.note.user?.host ? "@" + body.note.user?.host : ""),
			icon_url: body.note.user?.avatarUrl
		},
		title: "投稿" + (body.note.visibility === "home" ? " : ホーム" : body.note.visibility === "followers" ? " : フォロワー限定" : body.note.visibility === "specified" ? " : ダイレクト" : ""),
    	url: "https://mkkey.net/notes/" + body.note.id,
		description: (body.note.text ?? "") + (body.note.text && body.note.cw ? " " : "") + (body.note.cw ? "(CW)": ""),
		thumbnail: {
			url: body.note.user?.avatarUrl
		},
		footer: {
			text: body.note.createdAt
		},
		color: 16757683,
	} : undefined,
	body.user ? {
		title: "ユーザ",
    	url: "https://mkkey.net/@" + body.user.username + (body.user.host ? "@" + body.user.host : ""),
		description: body.user.name ? (body.user.name + " (" + body.user.username + (body.user.host ? "@" + body.user.host : "") + ")") : (body.user.username + (body.user.host ? "@" + body.user.host : "")),
		thumbnail: {
			url: body.user.avatarUrl
		},
		color: 16757683,
	} : undefined
	].map((x) => x != undefined)
}

export default async (job: Bull.Job<WebhookDeliverJobData>) => {
	try {
		logger.debug(`delivering ${job.data.webhookId}`);
		let res;
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
				body: JSON.stringify({
					content: job.data.type,
					embeds: toEmbeds(job.data.content),
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
