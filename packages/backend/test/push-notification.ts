process.env.NODE_ENV = "test";

import * as assert from "assert";
import * as childProcess from "child_process";
import { async, signup, startServer, shutdownServer } from "./utils.js";
import config from "../src/config/index.js";
import {
	isDefaultInstanceReaction,
	resolveMessagingNotificationDisplayImageUrl,
	resolveNoteEmbedImageUrl,
	resolveNoteNotificationDisplayImageUrl,
	resolveReactionNotificationBadgeUrl,
	resolveReactionNotificationIconUrl,
} from "../src/misc/notification-display-media.js";
import { resolveNotificationDisplayText } from "../src/misc/notification-display-text.js";
import {
	attachDisplayImageUrlToNotification,
	attachDisplayTextToNotification,
	attachReactionPushDisplayExtras,
	buildMinimalNotificationPayloadForPush,
} from "../src/services/push-notification.js";

describe("notification-display-media", () => {
	it("正常系: 先頭添付が画像のとき url を返す", () => {
		const url = resolveNoteEmbedImageUrl({
			files: [
				{
					type: "image/png",
					url: "https://example.com/a.png",
					isSensitive: false,
				},
			],
		});
		assert.strictEqual(url, "https://example.com/a.png");
	});

	it("異常系: センシティブ添付は表示用 URL を返さない", () => {
		const url = resolveNoteEmbedImageUrl({
			files: [
				{
					type: "image/png",
					url: "https://example.com/a.png",
					isSensitive: true,
				},
			],
		});
		assert.strictEqual(url, undefined);
	});

	it("正常系: 動画は thumbnailUrl を displayImage に使う", () => {
		const url = resolveNoteNotificationDisplayImageUrl({
			files: [
				{
					type: "video/mp4",
					thumbnailUrl: "https://example.com/thumb.jpg",
					isSensitive: false,
				},
			],
		});
		assert.strictEqual(url, "https://example.com/thumb.jpg");
	});

	it("正常系: DM 画像添付", () => {
		const url = resolveMessagingNotificationDisplayImageUrl({
			file: {
				type: "image/png",
				url: "https://example.com/dm.png",
				isSensitive: false,
			},
		});
		assert.strictEqual(url, "https://example.com/dm.png");
	});

	it("正常系: 非デフォルト Unicode リアクションの icon URL を解決する", () => {
		const url = resolveReactionNotificationIconUrl("😀", null, "⭐");
		assert.strictEqual(
			url,
			`${config.url}/twemoji/1f600.svg`,
		);
	});

	it("正常系: デフォルトリアクションの icon URL は返さない", () => {
		const url = resolveReactionNotificationIconUrl("⭐", null, "⭐");
		assert.strictEqual(url, undefined);
	});

	it("正常系: カスタム絵文字リアクションの icon URL を解決する", () => {
		const url = resolveReactionNotificationIconUrl(":blobcat:", {
			emojis: [
				{
					name: "blobcat",
					url: "https://example.com/blobcat.png",
				},
			],
		}, "⭐");
		assert.strictEqual(url, "https://example.com/blobcat.png");
	});

	it("正常系: 非デフォルト Unicode リアクションの badge URL を解決する", () => {
		const url = resolveReactionNotificationBadgeUrl("😀", null, "⭐");
		assert.strictEqual(
			url,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: isDefaultInstanceReaction が加算リアクションを既定扱いする", () => {
		assert.strictEqual(isDefaultInstanceReaction("⭐ (+1)", "⭐"), true);
		assert.strictEqual(isDefaultInstanceReaction("😀", "⭐"), false);
	});

	it("境界値: attachReactionPushDisplayExtras が reaction 用フィールドを付与する", () => {
		const out = attachReactionPushDisplayExtras(
			{
				type: "reaction",
				reaction: "😀",
			},
			"⭐",
		);
		assert.strictEqual((out as { defaultReaction?: string }).defaultReaction, "⭐");
		assert.strictEqual(
			(out as { reactionIconUrl?: string }).reactionIconUrl,
			`${config.url}/twemoji/1f600.svg`,
		);
		assert.strictEqual(
			(out as { reactionBadgeUrl?: string }).reactionBadgeUrl,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: attachDisplayImageUrlToNotification が displayImageUrl を付与する", () => {
		const out = attachDisplayImageUrlToNotification(
			{
				type: "mention",
				note: {
					files: [
						{
							type: "image/png",
							url: "https://example.com/n.png",
							isSensitive: false,
						},
					],
				},
			},
			"⭐",
		);
		assert.strictEqual(
			(out as { displayImageUrl?: string }).displayImageUrl,
			"https://example.com/n.png",
		);
	});
});

describe("notification-display-text", () => {
	it("正常系: mention の displayTitle / displayBody を解決する", () => {
		const resolved = resolveNotificationDisplayText({
			type: "mention",
			user: { username: "alice", name: "Alice" },
			note: { text: "こんにちは" },
		});
		assert.strictEqual(resolved?.displayTitle, "Alice から 呼びかけ");
		assert.strictEqual(resolved?.displayBody, "こんにちは");
	});

	it("正常系: wasBlocked の displayTitle を解決する", () => {
		const resolved = resolveNotificationDisplayText({
			type: "wasBlocked",
			user: { username: "bob", name: "Bob", host: "example.com" },
		});
		assert.strictEqual(
			resolved?.displayTitle,
			"Bob (bob@example.com) から ブロックされました",
		);
	});

	it("境界値: attachDisplayTextToNotification が displayTitle を付与する", () => {
		const out = attachDisplayTextToNotification(
			{
				type: "userWasUnfollowed",
				user: { username: "carol", name: "Carol", host: "example.com" },
			},
			"⭐",
		);
		assert.strictEqual(
			(out as { displayTitle?: string }).displayTitle,
			"Carol (carol@example.com) から リムーブされました",
		);
	});
});

describe("push-notification", () => {
	let p: childProcess.ChildProcess;
	let alice: { id: string; token: string };

	before(async () => {
		p = await startServer();
		alice = await signup({ username: "push_alice" });
	});

	after(async () => {
		await shutdownServer(p);
	});

	it("正常系: 購読が無い場合 test-push-notification は no_subscriptions を返す", async(async () => {
		const res = await fetch("http://localhost:61812/api/i/test-push-notification", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({}),
		});
		const body = await res.json();
		assert.strictEqual(body.ok, false);
		assert.strictEqual(body.subscriptionCount, 0);
	}));

	it("境界値: minimal ペイロードに userId と user が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif1",
			type: "wasBlocked",
			userId: "user1",
			user: {
				id: "user1",
				username: "alice",
				name: "Alice",
				avatarUrl: "https://example.com/avatar.png",
			},
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(result.id, "notif1");
		assert.strictEqual(result.type, "wasBlocked");
		assert.strictEqual(result.userId, "user1");
		assert.deepStrictEqual(result.user, {
			id: "user1",
			username: "alice",
			name: "Alice",
			avatarUrl: "https://example.com/avatar.png",
		});
		assert.strictEqual((result as { note?: unknown }).note, undefined);
	});

	it("境界値: minimal ペイロードに displayImageUrl が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif2",
			type: "mention",
			displayImageUrl: "https://example.com/large.png",
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(
			(result as { displayImageUrl?: string }).displayImageUrl,
			"https://example.com/large.png",
		);
	});

	it("境界値: minimal ペイロードに reaction 表示用フィールドが残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif4",
			type: "reaction",
			reaction: "😀",
			defaultReaction: "⭐",
			reactionIconUrl: `${config.url}/twemoji/1f600.svg`,
			reactionBadgeUrl: `${config.url}/twemoji-badge/1f600.png`,
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual((result as { reaction?: string }).reaction, "😀");
		assert.strictEqual(
			(result as { defaultReaction?: string }).defaultReaction,
			"⭐",
		);
		assert.strictEqual(
			(result as { reactionIconUrl?: string }).reactionIconUrl,
			`${config.url}/twemoji/1f600.svg`,
		);
		assert.strictEqual(
			(result as { reactionBadgeUrl?: string }).reactionBadgeUrl,
			`${config.url}/twemoji-badge/1f600.png`,
		);
	});

	it("境界値: minimal ペイロードに viewNoteId が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif-reaction",
			type: "reaction",
			viewNoteId: "reacted-note-id",
			note: {
				id: "reacted-note-id",
				text: "x".repeat(5000),
			},
		});

		assert.strictEqual(
			(result as { viewNoteId?: string }).viewNoteId,
			"reacted-note-id",
		);
	});

	it("境界値: minimal ペイロードに renoteTargetNoteId と note.id が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif-renote",
			type: "renote",
			renoteTargetNoteId: "target-note-id",
			note: {
				id: "wrapper-note-id",
				userId: "poster-id",
				text: "x".repeat(5000),
			},
		});

		assert.strictEqual(
			(result as { renoteTargetNoteId?: string }).renoteTargetNoteId,
			"target-note-id",
		);
		assert.deepStrictEqual(
			(result as { note?: { id: string; userId: string } }).note,
			{ id: "wrapper-note-id", userId: "poster-id" },
		);
	});

	it("境界値: minimal ペイロードに displayTitle / displayBody が残る", () => {
		const result = buildMinimalNotificationPayloadForPush({
			id: "notif3",
			type: "mention",
			displayTitle: "Alice から 呼びかけ",
			displayBody: "本文抜粋",
			note: { text: "x".repeat(5000) },
		});

		assert.strictEqual(
			(result as { displayTitle?: string }).displayTitle,
			"Alice から 呼びかけ",
		);
		assert.strictEqual(
			(result as { displayBody?: string }).displayBody,
			"本文抜粋",
		);
	});

	it("正常系: dev モードでない場合 push-log は空配列", async(async () => {
		const res = await fetch("http://localhost:61812/api/i/push-log", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${alice.token}`,
			},
			body: JSON.stringify({ limit: 10 }),
		});
		assert.strictEqual(res.status, 200);
		const body = await res.json();
		assert.ok(Array.isArray(body));
		assert.strictEqual(body.length, 0);
	}));
});
